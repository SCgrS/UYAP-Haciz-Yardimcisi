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
// 4: durdurma düğmesi ve çalıştırma kimliği.
const PROTOCOL = 4;

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

// --- Çalıştırma kimliği ve durdurma -------------------------------------------
//
// Her başlatmada yeni bir kimlik üretilir ve sayfaya verilir. Sayfa onu her
// mesajına geri ekler, kimliği tutmayan mesaj yazılmaz: Durdurulmuş ya da
// yerini yenisine bırakmış bir akışın geç kalan mesajı ekrandaki durumu
// ezemez. Kimlik, çalıştırmanın sekmesiyle birlikte ayrıca saklanır. Durdurma
// isteği o sekmeye gider, kullanıcı bu arada başka sekmeye geçmiş olsa da.
const RUN_KEY = 'ubh_run';

// Durdurma isteğinden sonra sayfanın yanıt vermesi için beklenen süre. Sayfa
// bu sürede ne "istek alındı" ne "durdu" derse (sekme kapandı, sayfa
// yenilendi) popup yine de bırakılır. Sayfa isteği aldığını bildirdiyse
// STOP_ACK_GRACE_MS'ye kadar beklenir: Akış, UYAP'ın o an eklemekte olduğu
// kaydın sonucunu bekleyip öyle durur (en kötü durumda bir dakika kadar).
const STOP_GRACE_MS = 8000;
const STOP_ACK_GRACE_MS = 90 * 1000;

// Sayfa durmayı kendisi bildiremediyse özette yazılan cümle.
const STOP_NO_REPLY = 'Sayfadan yanıt alınamadı. Talebe eklenenleri Talep Gönder sekmesinden denetleyin';

let stopTimer = null;

const newRunId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Kimliksiz eski bir kayıtta her mesaj kabul edilir.
const sameRun = message => !current.runId || message?.run === current.runId;

// Başlatma sürerken (betikler yüklenirken) durdurma düğmesine basılmış olabilir.
// O zaman sayfaya START gönderilmez: Gönderilseydi popup "Durduruldu" derken
// akış baştan sona çalışırdı.
const startStillWanted = runId =>
  current?.runId === runId && current.state === 'running' && !current.stopping;

// Durdurulan çalıştırmada yarıda kalan bölüm satırı da "Durduruldu" olur.
// Sayfa durmayı kendisi bildiremediyse (sekme kapandı) satır çalışıyor
// görünmesin.
const stopStages = stages => (stages || []).map(item =>
  item.state === 'running' ? { ...item, state: 'stopped', note: 'Durduruldu' } : item
);

// Çalıştırmayı sonuçlandırır: Tamamlandı, takıldı ya da durduruldu. Durum
// yalnız beklenen durumlardan birindeyse değişir. Değilse mesaj geç
// kalmıştır.
async function endRun(message, state, label, from) {
  await ensureProgress();
  if (!sameRun(message) || !from.includes(current.state)) return;

  clearTimeout(stopTimer);

  // Durdurulmuş bir çalıştırmaya geç gelen boş özet, yazılı özeti silmez.
  const detail = message.detail ||
    (state === 'stopped' && current.state === 'stopped' ? current.detail : '') || '';

  current = {
    stages: [],
    ...current,
    state,
    label,
    detail,
    stopping: false,
    at: Date.now()
  };
  if (state === 'stopped') current.stages = stopStages(current.stages);

  // Kural 4: Çalıştırma bitince geçici banka belleği silinir.
  await Promise.all([publish(), clearBanks()]);
}

// Popup'taki durdurma düğmesi. İstek çalıştırmanın sekmesine gider. Akışı
// kesmek, açık kutuları kapatmak ve özeti yazmak sayfanın işidir. Sayfa
// yanıt vermezse popup yine de bırakılır.
async function stopRun(fallbackTabId) {
  await ensureProgress();
  if (current.state !== 'running') return { ok: true };

  const runId = current.runId || '';

  if (!current.stopping) {
    current = { ...current, label: 'Durduruluyor', stopping: true, at: Date.now() };
    await publish();
  }

  const stored = (await chrome.storage.session.get(RUN_KEY))[RUN_KEY];
  const tabId = stored?.runId === runId && stored?.tabId ? stored.tabId : fallbackTabId;

  // Bekleme süresi istekten ÖNCE kurulur: Sayfanın "istek alındı" yanıtı,
  // gönderim tamamlanmadan gelip süreyi uzatabilir (bkz. ackStop).
  armStopTimer(runId, STOP_GRACE_MS);

  let delivered = false;
  if (tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'UBH_STOP', runId });
      delivered = true;
    } catch (_) {
      // Sekme kapanmış ya da sayfa yenilenmiş: Durduracak bir akış kalmamış.
    }
  }

  if (!delivered) {
    clearTimeout(stopTimer);
    await endRun({ run: runId, detail: STOP_NO_REPLY }, 'stopped', 'Durduruldu', ['running']);
  }

  return { ok: true };
}

function armStopTimer(runId, ms) {
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    endRun({ run: runId, detail: STOP_NO_REPLY }, 'stopped', 'Durduruldu', ['running'])
      .catch(() => {});
  }, ms);
}

// Sayfa durdurma isteğini aldı ve akışı kesiyor. Popup, sayfanın özeti
// gelene kadar "Durduruluyor"da kalır.
async function ackStop(message) {
  await ensureProgress();
  if (!sameRun(message) || current.state !== 'running' || !current.stopping) return;

  armStopTimer(current.runId || '', STOP_ACK_GRACE_MS);
}

// Adım mesajı. Durdurulurken gelen adım yazılmaz: Ekranda "Durduruluyor"
// kalsın.
async function setStep(message) {
  await ensureProgress();
  if (!sameRun(message) || current.state !== 'running' || current.stopping) return;

  current = {
    ...current,
    label: message.label,
    index: message.index,
    total: message.total,
    at: Date.now()
  };
  await publish();
}

// Aynı bölüm önce 'running', sonra 'done', 'error' ya da 'stopped' olarak
// gelir. Satır anahtarına göre değiştirilir, listeye ikinci kez eklenmez.
async function setStage(entry, message) {
  await ensureProgress();
  if (!sameRun(message) || !['running', 'stopped'].includes(current.state)) return;

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

  const runId = newRunId();
  clearTimeout(stopTimer);

  // Kural 1: her yeni çalıştırmada eski banka listesi silinir.
  await clearBanks();
  // Yeni çalıştırma, önceki akışın bölüm satırları ve özetiyle başlamaz.
  await setProgress('running', 'Başlatılıyor', {
    stages: [], detail: '', index: 0, total: 0, runId, stopping: false
  });
  await chrome.storage.session.set({ [RUN_KEY]: { tabId, runId } });

  let injected = true;
  try {
    await injectScripts(tabId);
  } catch (_) {
    // Enjeksiyon başarısız olsa bile sayfada çalışan bir kopya olabilir;
    // gönderim yine denenir.
    injected = false;
  }

  if (injected) await wait(150);

  if (!startStillWanted(runId)) return { ok: false };

  if (await deliverStart(tabId, { ...run, runId })) return { ok: true };

  if (startStillWanted(runId)) {
    await setProgress('error', 'Sayfaya bağlanılamadı, sayfayı yenileyin');
  }
  return { ok: false };
}

// --- Mesaj yönlendirme ------------------------------------------------------

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        // Çalışacak haciz türleri, ücret onayı ve banka talebinin evrak türü:
        // popup'ın verdiği kararlar. Evrak türü tanınmazsa öntanımlı 89/1'dir.
        types: Array.isArray(message.types) ? message.types : [],
        paid: message.paid === true,
        bankaTalep: message.bankaTalep === 'muzekkere' ? 'muzekkere' : 'ihbarname'
      }).then(sendResponse);
      return true;

    case 'UBH_STEP':
      setStep(message).then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_DONE':
      // Kural 4: tüm işlemler eksiksiz tamamlandığında silinir (bkz. endRun).
      // Alt satırda sonucun özeti durur: kaç kayıt eklendi, evrak oluştu mu.
      endRun(message, 'done', message.label || 'Tamamlandı', ['running'])
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_FAIL':
      // Engelin adı biliniyorsa başlık odur; bilinmiyorsa eski genel başlık
      // kalır. Alt satırda UYAP'ın kendi cümlesi ya da nerede durulduğu yazar.
      endRun(message, 'error', message.label || 'Bir şeyler ters gitti', ['running'])
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_STOP':
      stopRun(message.tabId).then(sendResponse);
      return true;

    case 'UBH_STOPPING':
      ackStop(message).then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_STOPPED':
      // Sayfa akışı kesti ve açık kutuları kapattı. Alt satırda o ana kadar
      // talebe eklenen kayıtların sayısı durur. Bekleme süresi dolduğu için
      // popup daha önce bırakıldıysa yalnız bu özet yazılır.
      endRun(message, 'stopped', 'Durduruldu', ['running', 'stopped'])
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_RESET':
      // Dosyadan ayrılındı: geçici banka belleği ve ekrandaki özet silinir.
      // Sayfadan gelen istek, bir çalıştırma sürerken yok sayılır: Başka bir
      // UYAP sekmesinde dosya değiştirmek, süren akışın durumunu silmesin.
      // Popup'tan gelen istek (Yeni Sorgu Yap) her zaman geçerlidir.
      ensureProgress()
        .then(() => {
          if (sender.tab && current.state === 'running') return null;
          clearTimeout(stopTimer);
          return clearBanks().then(() => setProgress('idle', 'Hazır', {
            stages: [], index: 0, total: 0, detail: '', stopping: false
          }));
        })
        .then(() => sendResponse({ ok: true }));
      return true;

    case 'UBH_STAGE':
      setStage({
        key: message.key,
        name: message.name,
        state: message.state,
        note: message.note || '',
        // Bölüm yürüse de kullanıcının gözden geçirmesi gereken satırlar:
        // atlanan kurumlar, banka sonucunun teyit hatırlatması.
        warns: Array.isArray(message.warns) ? message.warns : []
      }, message).then(() => sendResponse({ ok: true }));
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
