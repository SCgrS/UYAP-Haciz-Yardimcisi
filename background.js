// Service worker: popup <-> sayfa arasındaki tek koordinasyon noktası.
//
// Banka adları YALNIZ chrome.storage.session içinde tutulur. Bu alan Chrome'un
// geçici (RAM) depolamasıdır; tarayıcı kapandığında kendiliğinden silinir.
// Ek olarak: her yeni çalıştırmada, 10 dakikalık sürenin sonunda ve tüm adımlar
// eksiksiz tamamlandığında elle silinir.
'use strict';

// Popup her açılışta diskten okunur; service worker ile sayfaya enjekte edilen
// betikler ise eklenti Chrome'da YENİLENENE kadar eski sürümde kalır. Bu
// karışım sessiz ve pahalı bir hataya yol açıyordu: yeni popup'ta kaldırılan
// haciz türü tiki eski service worker'a hiç ulaşmıyor, toplu akış yine dört
// türü de sorguluyordu. Sorgu hakları sayılı olduğu için bu numara ile popup,
// arka planın kendi sürümüyle konuşup konuşmadığını çalıştırmadan önce anlar.
const PROTOCOL = 2;

const BANKS_KEY = 'ubh_banks';
const PROGRESS_KEY = 'ubh_progress';
const BANKS_TTL_MS = 10 * 60 * 1000;
const EXPIRE_ALARM = 'ubh_banks_expire';


// --- Geçici banka belleği ---------------------------------------------------

async function clearBanks() {
  await chrome.storage.session.remove(BANKS_KEY);
  await chrome.alarms.clear(EXPIRE_ALARM);
}

async function saveBanks(banks) {
  await chrome.storage.session.set({
    [BANKS_KEY]: { banks, savedAt: Date.now() }
  });
  // 10 dakika sonra kendiliğinden sil.
  await chrome.alarms.create(EXPIRE_ALARM, { delayInMinutes: 10 });
}

async function getBanks() {
  const stored = await chrome.storage.session.get(BANKS_KEY);
  const entry = stored[BANKS_KEY];

  if (!entry) return [];

  if (Date.now() - entry.savedAt > BANKS_TTL_MS) {
    await clearBanks();
    return [];
  }
  return entry.banks;
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === EXPIRE_ALARM) clearBanks();
});

// --- Popup'a yansıyan ilerleme durumu ---------------------------------------
// Yalnız durum kodu, adım metni, sayaç ve toplu akışta bölüm satırları
// ("EGM - tamamlandı", "TAKBİS - taşınmaz kaydı yok") tutulur; dosya veya taraf
// bilgisi hiçbir zaman yazılmaz.

// Adım ve bölüm mesajları saniyede birkaç kez, birbirini beklemeden geliyor.
// Her mesajda kaydı depodan OKUYUP üzerine yazmak yarış doğuruyordu: bir adım
// mesajı, kendisinden hemen önce yazılan bölüm satırını okumadan geçip listeyi
// eskisiyle geri yazıyor ve satırlar teker teker kayboluyordu. Bu yüzden kayıt
// service worker'ın belleğinde tutulur; mesajlar onu tek tek, aralarında await
// olmadan değiştirir, depoya yazmak yalnız popup'ı haberdar etmek içindir.
let current = null;
let loading = null;

// Service worker uykuya dalıp yeniden uyanmışsa bellek boştur; kayıt bir kez
// depodan tazelenir.
function ensureProgress() {
  if (current) return Promise.resolve(current);

  if (!loading) {
    loading = chrome.storage.session.get(PROGRESS_KEY).then(stored => {
      current = current ||
        stored[PROGRESS_KEY] ||
        { state: 'idle', label: 'Hazır', at: Date.now(), stages: [] };
      loading = null;
      return current;
    });
  }
  return loading;
}

// Yazmalar zincire dizilir: kayıtlar aynı sıra ile depoya düşsün, geç biten
// eski bir yazma yenisini geri almasın.
let writing = Promise.resolve();

function publish() {
  const snapshot = { ...current };
  writing = writing.then(() =>
    chrome.storage.session.set({ [PROGRESS_KEY]: snapshot })
  );
  return writing;
}

// ensureProgress'ten SONRA daima güncel "current" okunur; bekleme sırasında
// başka bir mesaj kaydı değiştirmiş olabilir. Okuma ile yazma arasında await
// yoktur, bu yüzden iki mesaj birbirinin satırını ezemez.
async function setProgress(state, label, extra = {}) {
  await ensureProgress();

  current = { stages: [], ...current, state, label, at: Date.now(), ...extra };

  await publish();
}

// Aynı bölüm önce 'running', sonra 'done' ya da 'error' olarak gelir; satır
// anahtarına göre değiştirilir, listeye ikinci kez eklenmez.
async function setStage(entry) {
  await ensureProgress();

  const stages = [...(current.stages || [])];
  const index = stages.findIndex(item => item.key === entry.key);

  if (index >= 0) stages[index] = entry;
  else stages.push(entry);

  current = { ...current, stages, at: Date.now() };

  await publish();
}

// --- Popup istekleri --------------------------------------------------------

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function deliverStart(tabId, run) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'UBH_START', ...run });
    return true;
  } catch (_) {
    return false;
  }
}

// Eklenti kurulduğunda ya da güncellendiğinde, o an açık olan sekmelere yeni
// content script kendiliğinden girmez; sayfada ESKİ sürüm çalışmaya devam eder.
// Eski köprü de mesajı karşıladığından, "gönderemezsem enjekte ederim" yaklaşımı
// eski sürümün sessizce çalışmasına yol açıyordu: yeni popup'ta hangi düğmeye
// basılırsa basılsın eski kod mesajdaki haciz türünü tanımayıp banka akışını
// başlatıyordu. Bu yüzden betikler MESAJDAN ÖNCE, her çalıştırmada yeniden
// yüklenir. İki dosyada da nesil damgası vardır: en son yüklenen kopya iş görür,
// eskiler sessizce çekilir. Böylece eklentiyi yenilemek için sayfayı yenilemek
// gerekmez.
async function injectScripts(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['bridge.js']
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
    world: 'MAIN'
  });
}

async function startRun(tabId, run) {
  if (!tabId) {
    await setProgress('error', 'UYAP Avukat Portalı sekmesi bulunamadı');
    return { ok: false };
  }

  // Kural 1: her yeni çalıştırmada eski banka listesi silinir.
  await clearBanks();
  // Yeni çalıştırma, önceki akışın bölüm satırları ve özetiyle başlamaz.
  await setProgress('running', 'Başlatılıyor', { stages: [], detail: '' });

  let injected = true;
  try {
    await injectScripts(tabId);
  } catch (_) {
    // Enjeksiyon başarısız olsa bile sayfada çalışan bir kopya olabilir;
    // gönderim yine denenir.
    injected = false;
  }

  if (injected) await wait(150);

  if (await deliverStart(tabId, run)) return { ok: true };

  await setProgress('error', 'Sayfaya bağlanılamadı, sayfayı yenileyin');
  return { ok: false };
}

// --- Mesaj yönlendirme ------------------------------------------------------

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  switch (message?.type) {
    case 'UBH_PING':
      sendResponse({
        ok: true,
        protocol: PROTOCOL,
        version: chrome.runtime.getManifest().version
      });
      return false;

    case 'UBH_START':
      startRun(message.tabId, {
        // Çalışacak haciz türleri ve ücret onayı: popup'ın verdiği tek karar.
        types: Array.isArray(message.types) ? message.types : [],
        paid: message.paid === true
      }).then(sendResponse);
      return true;

    case 'UBH_STEP':
      setProgress('running', message.label, { index: message.index, total: message.total })
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_DONE':
      // Kural 4: tüm işlemler eksiksiz tamamlandığında silinir.
      // Alt satırda sonucun özeti durur: kaç kayıt eklendi, evrak oluştu mu.
      clearBanks()
        .then(() => setProgress(
          'done',
          message.label || 'Tamamlandı',
          { detail: message.detail || '' }
        ))
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_FAIL':
      // Engelin adı biliniyorsa başlık odur; bilinmiyorsa eski genel başlık
      // kalır. Alt satırda UYAP'ın kendi cümlesi ya da nerede durulduğu yazar.
      clearBanks()
        .then(() => setProgress(
          'error',
          message.label || 'Bir şeyler ters gitti',
          { detail: message.detail || '' }
        ))
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_RESET':
      // Dosyadan ayrılındı: geçici banka belleği ve ekrandaki özet silinir.
      clearBanks()
        .then(() => setProgress('idle', 'Hazır', { stages: [], index: 0, total: 0 }))
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_STAGE':
      setStage({
        key: message.key,
        name: message.name,
        state: message.state,
        note: message.note || ''
      }).then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_SAVE_BANKS':
      saveBanks(Array.isArray(message.banks) ? message.banks : [])
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_GET_BANKS':
      getBanks().then(banks => sendResponse({ ok: true, banks }));
      return true;

    case 'UBH_CLEAR_BANKS':
      clearBanks().then(() => sendResponse({ ok: true }));
      return true;

    default:
      return false;
  }
});
