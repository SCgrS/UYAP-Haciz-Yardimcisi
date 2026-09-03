// Popup: haciz türü başına bir düğme, ortak canlı adım göstergesi, tema ve
// seçenekler.
//
// Burada dosya/taraf verisi tutulmaz. chrome.storage.local yalnız tercihleri
// (tema, ödeme seçeneği, bölüm tikleri) saklar. Adım durumu
// chrome.storage.session'dadır.
'use strict';

const PROGRESS_KEY = 'ubh_progress';
const PREFS_KEY = 'ubh_prefs';
const UYAP_PREFIX = 'https://avukat.uyap.gov.tr/';

// Sorgu bölümleri: her biri kendi tercihlerini ayrı tutar.
const QUERY_FLOWS = ['egm', 'icra', 'takbis'];

// Toplu bölümün tek tercihi ücret onayıdır; sorgu bölümlerinin tikleriyle
// karışmasın diye ayrı tutulur.
const OPT_FLOWS = [...QUERY_FLOWS, 'toplu'];

// Sayfa kapanmış ya da sekme değişmişse "çalışıyor" durumu sonsuza kadar
// asılı kalmasın diye üst sınır. Sorgu akışlarında tek tek eklenecek çok
// sayıda kayıt olabildiğinden banka akışındaki süreye göre geniş tutulur.
const STALE_MS = 10 * 60 * 1000;

const el = {
  theme: document.getElementById('theme'),
  starts: [...document.querySelectorAll('.start')],
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text'),
  statusDetail: document.getElementById('status-detail'),
  statusFill: document.getElementById('status-fill'),
  stages: document.getElementById('stages'),
  optEnabled: document.getElementById('opt-enabled'),
  optChoices: document.getElementById('opt-choices'),
  optSms: document.getElementById('opt-sms'),
  optSmsInput: document.getElementById('opt-sms-input'),
  version: document.getElementById('version'),
  helpBtn: document.getElementById('help-btn'),
  help: document.getElementById('help')
};

// --- Tercihler --------------------------------------------------------------

// Sorgu bölümlerinde talep evrakı öntanımlı olarak oluşturulur; ücretli sorgu
// onayı ise para harcattığı için öntanımlı olarak kapalıdır.
function defaultPrefs() {
  const prefs = {
    theme: 'light',
    paymentEnabled: false,
    payment: 'vakifbank',
    sms: true,
    toplu: { paid: false }
  };
  for (const flow of QUERY_FLOWS) prefs[flow] = { evrak: true, paid: false };
  return prefs;
}

let prefs = defaultPrefs();

function applyPrefs() {
  document.documentElement.dataset.theme = prefs.theme;

  el.optEnabled.checked = prefs.paymentEnabled;
  el.optChoices.hidden = !prefs.paymentEnabled;

  const radio = document.querySelector(`input[name="payment"][value="${prefs.payment}"]`);
  if (radio) radio.checked = true;

  // SMS onayı yalnız Vakıfbank yolunda anlamlıdır.
  el.optSmsInput.checked = prefs.sms;
  el.optSms.hidden = !(prefs.paymentEnabled && prefs.payment === 'vakifbank');

  for (const input of document.querySelectorAll('[data-opt]')) {
    const [flow, key] = input.dataset.opt.split('.');
    input.checked = !!prefs[flow]?.[key];
  }
}

function savePrefs() {
  chrome.storage.local.set({ [PREFS_KEY]: prefs });
}

async function loadPrefs() {
  const stored = await chrome.storage.local.get(PREFS_KEY);
  const saved = stored[PREFS_KEY];

  if (saved) {
    prefs = { ...prefs, ...saved };
    // Bölüm tercihleri iç içe olduğundan tek tek birleştirilir; eski bir
    // sürümden gelen kayıtta bölüm hiç yoksa öntanımlı değerler kalır.
    for (const flow of OPT_FLOWS) {
      prefs[flow] = { ...defaultPrefs()[flow], ...(saved[flow] || {}) };
    }
  }
  applyPrefs();
}

// --- Durum ------------------------------------------------------------------

// Toplu akışta her bölüm için bir satır: durum noktası, bölümün adı ve
// gerekiyorsa altında tek satırlık not ("Araç kaydı yok", engelin adı ...).
// Metin daima textContent ile yazılır; sayfadan gelen bir cümle biçimlendirme
// olarak yorumlanmaz.
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

  for (const button of el.starts) button.disabled = state === 'running';

  // Hatada nerede durulduğunu söyleyen kısa ipucu.
  const detail = state === 'error' ? (progress?.detail || '') : '';
  el.statusDetail.textContent = detail;
  el.statusDetail.hidden = !detail;

  renderStages(Array.isArray(progress?.stages) ? progress.stages : []);

  let percent = 0;
  if (state === 'running' && total > 0) percent = Math.min(100, (index / total) * 100);
  else if (state === 'done') percent = 100;
  else if (state === 'error') percent = 100;

  el.statusFill.style.width = `${percent}%`;
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

el.optEnabled.addEventListener('change', () => {
  prefs.paymentEnabled = el.optEnabled.checked;
  applyPrefs();
  savePrefs();
});

for (const radio of document.querySelectorAll('input[name="payment"]')) {
  radio.addEventListener('change', () => {
    if (!radio.checked) return;
    prefs.payment = radio.value;
    applyPrefs();
    savePrefs();
  });
}

el.optSmsInput.addEventListener('change', () => {
  prefs.sms = el.optSmsInput.checked;
  savePrefs();
});

for (const input of document.querySelectorAll('[data-opt]')) {
  input.addEventListener('change', () => {
    const [flow, key] = input.dataset.opt.split('.');
    prefs[flow][key] = input.checked;
    savePrefs();
  });
}

el.helpBtn.addEventListener('click', () => {
  const open = el.helpBtn.getAttribute('aria-expanded') === 'true';
  el.helpBtn.setAttribute('aria-expanded', String(!open));
  el.help.hidden = open;
});

// Etkin sekme popup içinden bulunur: service worker'ın kendine ait bir
// pencere bağlamı yoktur, orada "currentWindow" güvenilir değildir.
async function activeUyapTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;
  if (tab.url && !tab.url.startsWith(UYAP_PREFIX)) return null;
  return tab;
}

for (const button of el.starts) {
  button.addEventListener('click', async () => {
    const flow = button.dataset.flow;
    const isBanka = flow === 'banka';
    // Toplu akış sabittir: bölüm tikleri ve ödeme seçeneği okunmaz.
    const isBulk = flow === 'toplu';

    for (const other of el.starts) other.disabled = true;
    render({ state: 'running', label: 'Başlatılıyor', at: Date.now() });

    const payment = prefs.paymentEnabled ? prefs.payment : 'none';

    try {
      const tab = await activeUyapTab();

      if (!tab) {
        render({ state: 'error', label: 'UYAP Avukat Portalı sekmesi bulunamadı' });
        return;
      }

      await chrome.runtime.sendMessage({
        type: 'UBH_START',
        tabId: tab.id,
        flow,
        payment: isBanka ? payment : 'none',
        sms: isBanka && payment === 'vakifbank' ? prefs.sms : false,
        // Banka akışında evrak türü hep girilir; sorgu akışlarında bölüm tiki
        // karar verir. Ücret onayı yalnız sorgu akışlarında sorulabilir.
        // Toplu akış ikisini de okumaz.
        evrak: isBulk ? false : isBanka ? true : !!prefs[flow]?.evrak,
        paid: isBanka ? false : !!prefs[flow]?.paid
      });
    } catch (_) {
      render({ state: 'error', label: 'Bir şeyler ters gitti' });
    }
  });
}

el.version.textContent = `v${chrome.runtime.getManifest().version}`;

loadPrefs();
refresh();
