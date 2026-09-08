// Popup: tek düğme, haciz türü tikleri, canlı adım göstergesi ve tema.
//
// Burada dosya/taraf verisi tutulmaz. chrome.storage.local yalnız tercihleri
// (tema, haciz türü tikleri, ücret onayı) saklar. Adım durumu
// chrome.storage.session'dadır.
'use strict';

// background.js ile aynı numara. Tutmuyorsa Chrome hâlâ eklentinin eski
// sürümünü çalıştırıyordur ve popup'ta yapılan seçimler sayfaya ulaşmaz;
// böyle bir durumda iş hiç başlatılmaz (bkz. background.js'teki açıklama).
const PROTOCOL = 2;

const PROGRESS_KEY = 'ubh_progress';
const PREFS_KEY = 'ubh_prefs';
const UYAP_PREFIX = 'https://avukat.uyap.gov.tr/';

// Toplu akışta çalışabilecek haciz türleri. Sıra burada değil sayfa tarafında
// belirlenir: banka seçiliyse daima en sonda çalışır.
const BULK_TYPES = ['egm', 'icra', 'takbis', 'banka'];

// Sayfa kapanmış ya da sekme değişmişse "çalışıyor" durumu sonsuza kadar
// asılı kalmasın diye üst sınır. Tek tek eklenecek çok sayıda kayıt
// olabildiğinden geniş tutulur.
const STALE_MS = 10 * 60 * 1000;

// Çalışma sürerken sayfaya dokunmak sıralamayı bozabiliyor; uyarı tam da o
// sırada, durum çubuğunun altında durur.
const RUNNING_HINT = 'İşlem sürerken sayfada bir yere tıklamayın; ' +
                     'sıralamayı ve işlemleri sekteye uğratabilirsiniz.';

const el = {
  theme: document.getElementById('theme'),
  start: document.getElementById('start'),
  reset: document.getElementById('reset'),
  info: document.querySelector('.info'),
  infoPanel: document.querySelector('.info__panel'),
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  statusDetail: document.getElementById('status-detail'),
  statusFill: document.getElementById('status-fill'),
  stages: document.getElementById('stages'),
  version: document.getElementById('version')
};

// --- Tercihler --------------------------------------------------------------

// Dört haciz türü de öntanımlı olarak tiklidir: olağan kullanım hepsini
// hazırlamaktır, tik kaldırmak istisnadır. Ücretli sorgu onayı ise para
// harcattığı için öntanımlı olarak kapalıdır.
function defaultPrefs() {
  return {
    theme: 'light',
    toplu: { paid: false, egm: true, icra: true, takbis: true, banka: true }
  };
}

let prefs = defaultPrefs();

function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme;

  for (const input of document.querySelectorAll('[data-opt]')) {
    const [group, key] = input.dataset.opt.split('.');
    input.checked = !!prefs[group]?.[key];
  }
}

function savePrefs() {
  chrome.storage.local.set({ [PREFS_KEY]: prefs });
}

async function loadPrefs() {
  const stored = await chrome.storage.local.get(PREFS_KEY);
  const saved = stored[PREFS_KEY];

  // Yalnız tanınan alanlar alınır: eski sürümlerden kalan (ödeme türü, bölüm
  // tikleri) anahtarlar taşınmaz.
  if (saved) {
    if (saved.theme === 'dark' || saved.theme === 'light') prefs.theme = saved.theme;
    prefs.toplu = { ...defaultPrefs().toplu, ...(saved.toplu || {}) };
  }
  applyPrefs();
}

// --- Bilgi kutusu -----------------------------------------------------------
//
// Kutu CSS’teki :hover ile değil buradan açılır. Sabit konumlu (position:
// fixed) olduğu için yerini kendisi bilemez: dikey konumu, işaretin o anki
// yerine göre burada hesaplanır. Aşağıda yer kalmadıysa kutu işaretin üstüne
// alınır; böylece popup’ın dışına taşıp kırpılmaz.
//
// Kapanış birkaç salise geciktirilir: imleç işaretten kutuya geçerken
// aradaki boşlukta kutu bir an “terk edilmiş” sayılıyordu.

const INFO_GAP = 6;          // işaret ile kutu arasındaki boşluk
const INFO_EDGE = 8;         // kutunun popup kenarına en fazla yaklaşacağı yer
const INFO_CLOSE_MS = 140;

let infoOpen = false;
let infoTimer = 0;

function placeInfo() {
  const panel = el.infoPanel;

  // Yükseklik ancak çizildikten sonra ölçülebilir. Ölçüm sırasında kutu
  // görünmez tutulur ki yanlış yerde bir an parlamasın.
  const hidden = panel.style.display !== 'block';
  if (hidden) {
    panel.style.visibility = 'hidden';
    panel.style.display = 'block';
  }

  panel.classList.remove('info__panel--up');

  const icon = el.info.getBoundingClientRect();
  const height = panel.offsetHeight;
  // clientHeight kullanılır, innerHeight değil: innerHeight varsa yatay
  // kaydırma çubuğunu da sayar ve “aşağıda yer var” diyip kutuyu kırpılacak
  // bir yere açabilir.
  const viewport = document.documentElement.clientHeight;
  const roomBelow = viewport - icon.bottom - INFO_GAP - INFO_EDGE;

  let top;
  if (height <= roomBelow) {
    top = icon.bottom + INFO_GAP;
  } else {
    // Aşağıda yer yok: kutu işaretin üstüne alınır.
    top = icon.top - INFO_GAP - height;
    panel.classList.add('info__panel--up');

    // Yukarıda da yer yoksa kutu pencereye sığdırılır ve olabildiğince
    // aşağıda tutulur: hiç değilse başlık satırı görünür kalsın.
    if (top < INFO_EDGE) {
      top = Math.max(INFO_EDGE, viewport - height - INFO_EDGE);
    }
  }

  panel.style.top = `${Math.round(top)}px`;
  panel.style.visibility = '';
}

function showInfo() {
  clearTimeout(infoTimer);
  if (infoOpen) return;
  infoOpen = true;
  placeInfo();
}

function hideInfo() {
  clearTimeout(infoTimer);
  infoOpen = false;
  el.infoPanel.style.display = '';
  el.infoPanel.style.visibility = '';
  el.infoPanel.classList.remove('info__panel--up');
}

function hideInfoSoon() {
  clearTimeout(infoTimer);
  infoTimer = setTimeout(hideInfo, INFO_CLOSE_MS);
}

// Kutu işaretin çocuğudur; pointerenter/pointerleave alt düğümlere girip
// çıkarken tetiklenmediği için imleç kutunun üstündeyken de “işaretin
// üstünde” sayılır.
el.info.addEventListener('pointerenter', showInfo);
el.info.addEventListener('pointerleave', hideInfoSoon);
el.info.addEventListener('focus', showInfo);
el.info.addEventListener('blur', hideInfo);
el.info.addEventListener('keydown', event => {
  if (event.key === 'Escape') hideInfo();
});

// Kutunun genişliği pencereye bağlıdır: pencere daralınca metin farklı sarılır
// ve yükseklik değişir. Açık duran kutu o zaman yanlış yerde kalırdı.
window.addEventListener('resize', () => {
  if (infoOpen) placeInfo();
});

// --- Durum ------------------------------------------------------------------

// Her bölüm için bir satır: durum noktası, bölümün adı ve gerekiyorsa altında
// tek satırlık not ("Araç kaydı yok", engelin adı ...). Metin daima
// textContent ile yazılır; sayfadan gelen bir cümle biçimlendirme olarak
// yorumlanmaz.
function stageRow(item) {
  const row = document.createElement('li');
  row.className = 'stage';
  row.dataset.state = item.state || 'running';

  const dot = document.createElement('span');
  dot.className = 'stage__dot';
  row.append(dot);

  const body = document.createElement('span');
  body.className = 'stage__body';

  const name = document.createElement('span');
  name.className = 'stage__name';
  name.textContent = item.name || '';
  body.append(name);

  if (item.note) {
    const note = document.createElement('span');
    note.className = 'stage__note';
    note.textContent = item.note;
    body.append(note);
  }

  row.append(body);
  return row;
}

function renderStages(stages) {
  el.stages.hidden = stages.length === 0;
  el.stages.replaceChildren(...stages.map(stageRow));
}

function render(progress) {
  let state = progress?.state || 'idle';
  let label = progress?.label || 'Hazır';

  if (state === 'running' && Date.now() - (progress.at || 0) > STALE_MS) {
    state = 'error';
    label = 'Bir şeyler ters gitti';
  }

  const total = progress?.total || 0;
  const index = progress?.index || 0;

  el.status.dataset.state = state;
  el.statusText.textContent = label;

  el.start.disabled = state === 'running';

  // Çalıştırma bitmiştir: ya sonuç yazılıdır ya da nerede takıldığı. İki
  // durumda da ekranda duran özeti kaldırıp “Hazır”a dönmenin bir yolu olmalı.
  el.reset.hidden = !(state === 'done' || state === 'error');

  // Bittiğinde SONUÇ özeti, takıldığında nerede durulduğu, çalışırken de
  // sayfaya dokunmama uyarısı aynı satırda görünür.
  let detail = '';
  if (state === 'done' || state === 'error') detail = progress?.detail || '';
  else if (state === 'running') detail = RUNNING_HINT;

  el.statusDetail.textContent = detail;
  el.statusDetail.hidden = !detail;

  renderStages(Array.isArray(progress?.stages) ? progress.stages : []);

  let percent = 0;
  if (state === 'running' && total > 0) percent = Math.min(100, (index / total) * 100);
  else if (state === 'done') percent = 100;
  else if (state === 'error') percent = 100;

  el.statusFill.style.width = `${percent}%`;

  // Liste büyüyünce işaret aşağı kayar; açık duran kutu onunla birlikte gitsin.
  if (infoOpen) placeInfo();
}

async function refresh() {
  const stored = await chrome.storage.session.get(PROGRESS_KEY);
  render(stored[PROGRESS_KEY]);
}

chrome.storage.session.onChanged.addListener(changes => {
  if (changes[PROGRESS_KEY]) render(changes[PROGRESS_KEY].newValue);
});

// Askıda kalmış bir çalıştırma popup açıkken de fark edilsin.
setInterval(refresh, 5000);

// --- Olaylar ----------------------------------------------------------------

el.theme.addEventListener('click', () => {
  prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
  applyPrefs();
  savePrefs();
});

for (const input of document.querySelectorAll('[data-opt]')) {
  input.addEventListener('change', () => {
    const [group, key] = input.dataset.opt.split('.');
    prefs[group][key] = input.checked;
    savePrefs();
  });
}

// Etkin sekme popup içinden bulunur: service worker'ın kendine ait bir
// pencere bağlamı yoktur, orada "currentWindow" güvenilir değildir.
async function activeUyapTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  if (tab.url && !tab.url.startsWith(UYAP_PREFIX)) return null;
  return tab;
}

// Arka plan bu popup'la aynı sürüm mü? Eski service worker bilinmeyen mesaja
// yanıt vermez; o zaman sendMessage ya boş döner ya da hata atar.
async function workerReady() {
  try {
    const reply = await chrome.runtime.sendMessage({ type: 'UBH_PING' });
    return reply?.protocol === PROTOCOL;
  } catch (_) {
    return false;
  }
}

el.start.addEventListener('click', async () => {
  const types = BULK_TYPES.filter(type => prefs.toplu[type] !== false);

  if (types.length === 0) {
    render({ state: 'error', label: 'En az bir haciz türü seçin' });
    return;
  }

  el.start.disabled = true;
  render({ state: 'running', label: 'Başlatılıyor', at: Date.now() });

  try {
    const tab = await activeUyapTab();

    if (!tab) {
      render({ state: 'error', label: 'UYAP Avukat Portalı sekmesi bulunamadı' });
      return;
    }

    // Eski sürüm çalışıyorsa buradaki seçimler sayfaya ulaşmaz: sessizce
    // yanlış iş yapmaktansa hiç başlamamak gerekir.
    if (!await workerReady()) {
      render({
        state: 'error',
        label: 'Eklentiyi yenileyin',
        detail: 'Yeni sürüm yüklendi ama Chrome arka planda hâlâ eskisini ' +
                'çalıştırıyor. chrome://extensions sayfasında bu eklentinin ' +
                'yenile düğmesine basın.'
      });
      return;
    }

    await chrome.runtime.sendMessage({
      type: 'UBH_START',
      tabId: tab.id,
      types,
      paid: prefs.toplu.paid === true
    });
  } catch (_) {
    render({ state: 'error', label: 'Bir şeyler ters gitti' });
  }
});

// Biten bir çalıştırmanın özetini kaldırıp ekranı “Hazır”a döndürür: popup’ı
// kapatıp açmaya gerek kalmadan yeni bir sorgu yapılabilsin. Silme işini arka
// plan yapar; geçici banka belleği de orada durduğu için durumun tek kaynağı
// orasıdır. Arka plan uyanmadıysa hiç değilse ekran temizlenir.
el.reset.addEventListener('click', async () => {
  el.reset.hidden = true;

  try {
    await chrome.runtime.sendMessage({ type: 'UBH_RESET' });
  } catch (_) {
    await chrome.storage.session.set({
      [PROGRESS_KEY]: {
        state: 'idle',
        label: 'Hazır',
        at: Date.now(),
        stages: [],
        index: 0,
        total: 0,
        detail: ''
      }
    });
  }

  refresh();
});

el.version.textContent = `v${chrome.runtime.getManifest().version}`;

loadPrefs();
refresh();
