// UYAP Haciz Yardımcısı - sayfa tarafı otomasyonu (MAIN dünya).
//
// MAHREMİYET: Bu betik yalnız aşağıdakileri okur:
//   - düğme / sekme / seçenek etiketleri,
//   - "No / Kurum" tablosundaki BANKA kurum adları,
//   - Banka Seç ve Hesap Seç listelerindeki satır adları,
//   - sayfalayıcıdaki kayıt sayısı ve sayfa numaraları.
// Ayrıca sorgu sonucunda "... kaydı yok" cümlesinin çıkıp çıkmadığını anlamak
// için sayfa metninde YALNIZ o cümle kalıbı aranır; eşleşen cümle dışında
// hiçbir alan okunmaz, hiçbir yere yazılmaz.
// Dosya numarası, taraf adları, TCKN, hesap numarası ve bakiye hiçbir yerde
// okunmaz; ödeme ekranı hiç açılmaz. EGM, İcra Dosyası ve TAKBİS sonuç
// tablolarından plaka, ada/parsel, dosya numarası gibi hiçbir alan okunmaz;
// o tablolarda yalnız satırların ekleme düğmelerine basılır.
(() => {
  'use strict';

  // Eklenti kurulduğunda zaten açık olan sekmelere content script girmez; bu
  // yüzden service worker gerektiğinde bu dosyayı elle enjekte eder. Eklenti
  // yenilendiğinde ise sayfada kalan eski kopya silinemez, yalnız devre dışı
  // bırakılabilir. Nesil damgası bunu yapar: aynı anda yalnız en son yüklenen
  // kopya iş görür, eskiler sessizce çekilir. Böylece eklentiyi yenilemek için
  // UYAP sayfasını yeniden yüklemek gerekmez.
  const REGISTRY = (window.__UBH_CONTENT_V2 = window.__UBH_CONTENT_V2 || { gen: 0 });
  const MY_GENERATION = ++REGISTRY.gen;
  const isCurrent = () => REGISTRY.gen === MY_GENERATION;

  const TO_PAGE = 'UBH_TO_PAGE_V2';
  const TO_EXT = 'UBH_TO_EXT_V2';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const isVisible = el => !!el && el.offsetParent !== null;

  // =========================================================================
  // BÖLÜM 1 - BANKA EŞLEŞTİRME ÇEKİRDEĞİ (v1'den değiştirilmeden alınmıştır)
  // Bu bölümün mantığı ve zamanlaması saha ölçümleriyle oturmuştur.
  // =========================================================================

  // Saha ölçümü: ilk (soğuk) filtre işlemi 3040 ms'de henüz bitmemişti,
  // ~3140 ms'de sonuç görünür oldu. Eski 3000 ms bütçesi bir poll eksikti.
  const FILTER_BUDGET_MS = 8000;

  function normalize(value) {
    return String(value ?? '')
      .normalize('NFKC')
      .toLocaleUpperCase('tr-TR')
      .replace(/[.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function sourceKey(value) {
    return normalize(value);
  }

  function canonical(value) {
    let s = normalize(value);

    const suffixes = [
      'TÜRK ANONİM ORTAKLIĞI',
      'TÜRK ANONİM ŞİRKETİ',
      'ANONİM ORTAKLIĞI',
      'ANONİM ŞİRKETİ',
      'T A Ş',
      'T A O',
      'A Ş',
      'A O'
    ];

    for (const suffix of suffixes) {
      if (s.endsWith(` ${suffix}`)) {
        s = s.slice(0, -(suffix.length + 1)).trim();
        break;
      }
    }
    return s;
  }

  // Anahtarlar normalize edilmiş kaynak UYAP adlarıdır.
  // Böylece noktalama/boşluk farkları alias lookup'ı bozmaz.
  const ALIAS_REGISTRY = new Map([
    [sourceKey('AKBANK T.A.Ş.'), 'AKBANK TÜRK ANONİM ŞİRKETİ'],
    [sourceKey('TÜRKİYE VAKIFLAR BANKASI T.A.O.'), 'TÜRKİYE VAKIFLAR BANKASI TÜRK ANONİM ORTAKLIĞI'],
    [sourceKey('T.C. ZİRAAT BANKASI A.Ş.'), 'TÜRKİYE CUMHURİYETİ ZİRAAT BANKASI ANONİM ŞİRKETİ'],
    [sourceKey('TÜRKİYE HALK BANKASI A.Ş.'), 'TÜRKİYE HALK BANKASI ANONİM ŞİRKETİ GENEL MÜDÜRLÜĞÜ'],
    [sourceKey('QNB BANK A.Ş.'), 'QNB BANK ANONİM ŞİRKETİ']
  ]);

  // Bazı DevExtreme filtrelerinde uzun resmi unvan yerine kısa, ayırt edici
  // arama anahtarı daha güvenilir çalışıyor. Seçim yine TAM resmi ad ile doğrulanır.
  const SEARCH_REGISTRY = new Map([
    [sourceKey('T.O.M. KATILIM BANKASI A.Ş.'), 'T.O.M. KATILIM BANKASI']
  ]);

  function targetFor(sourceName) {
    return ALIAS_REGISTRY.get(sourceKey(sourceName)) || sourceName;
  }

  function searchFor(sourceName, expectedTarget) {
    return SEARCH_REGISTRY.get(sourceKey(sourceName)) || canonical(expectedTarget);
  }

  function findSourceGrid() {
    const grids = [...document.querySelectorAll('.dx-datagrid')].filter(isVisible);

    return grids.find(grid => {
      const headerRow = grid.querySelector('tr.dx-header-row');
      if (!headerRow) return false;

      const headers = [...headerRow.querySelectorAll('[role="columnheader"]')]
        .map(el => el.innerText.trim())
        .filter(Boolean);

      return headers.length === 2 &&
             headers[0] === 'No' &&
             headers[1] === 'Kurum';
    }) || null;
  }

  function readBanks() {
    const grid = findSourceGrid();
    if (!grid) return null;

    const kurumHeader = [...grid.querySelectorAll('tr.dx-header-row [role="columnheader"]')]
      .find(el => el.innerText.trim() === 'Kurum');

    const colIndex = kurumHeader?.getAttribute('aria-colindex');
    if (!colIndex) return null;

    const result = new Set();

    for (const row of grid.querySelectorAll('tr.dx-data-row')) {
      const cell = row.querySelector(`td[role="gridcell"][aria-colindex="${colIndex}"]`);
      const bankName = cell?.innerText.trim();
      if (bankName) result.add(bankName);
    }

    return result;
  }

  function findBankSelectGrid() {
    return [...document.querySelectorAll('.dx-datagrid')]
      .filter(isVisible)
      .find(grid =>
        grid.querySelector('td[role="columnheader"][aria-label="Sütun Banka Adı"]')
      ) || null;
  }

  function findBankSelectEditor() {
    const inputs = [...document.querySelectorAll('input')].filter(isVisible);

    const input = inputs.find(el =>
      normalize(el.getAttribute('placeholder')) === 'BANKA SEÇİNİZ'
    );
    if (!input) return null;

    const editor =
      input.closest('.dx-dropdowneditor') ||
      input.closest('.dx-selectbox') ||
      input.closest('.dx-dropdownbox') ||
      input.closest('.dx-texteditor');

    if (!editor) return null;

    const button =
      editor.querySelector('.dx-dropdowneditor-button') ||
      editor.querySelector('.dx-texteditor-buttons-container .dx-button') ||
      editor;

    return { input, button };
  }

  async function ensureBankGridOpen() {
    let grid = findBankSelectGrid();
    if (grid) return grid;

    await sleep(180);

    // Bekleme sırasında popup geri geldiyse butona basmak onu KAPATIR.
    grid = findBankSelectGrid();
    if (grid) return grid;

    const editor = findBankSelectEditor();
    if (!editor) return null;

    editor.button.click();

    const started = Date.now();
    while (Date.now() - started < 3000) {
      grid = findBankSelectGrid();
      if (grid) return grid;
      await sleep(80);
    }
    return null;
  }

  function getGridParts(grid) {
    const header = grid?.querySelector(
      'td[role="columnheader"][aria-label="Sütun Banka Adı"]'
    );
    const headerId = header?.id;
    const colIndex = header?.getAttribute('aria-colindex');

    if (!header || !headerId || !colIndex) return null;

    const filterInput = grid.querySelector(
      `input[aria-label="Filtre hücresi"][aria-describedby="${CSS.escape(headerId)}"]`
    );
    if (!filterInput) return null;

    return { colIndex, filterInput };
  }

  function setFilter(input, value) {
    input.focus();

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    if (!setter) throw new Error('Native setter yok');

    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const visibleRows = grid =>
    [...grid.querySelectorAll('tr.dx-data-row')].filter(isVisible);

  const rowBankName = (row, colIndex) =>
    row.querySelector(`td[role="gridcell"][aria-colindex="${colIndex}"]`)
      ?.innerText.trim() || '';

  function exactCandidateRows(expectedTarget) {
    const grid = findBankSelectGrid();
    const parts = getGridParts(grid);
    if (!grid || !parts) return [];

    const expectedCanonical = canonical(expectedTarget);

    return visibleRows(grid).filter(row => {
      const name = rowBankName(row, parts.colIndex);
      return name && canonical(name) === expectedCanonical;
    });
  }

  // Input DOM değeri DevExtreme filter state'i DEĞİLDİR. Commit'in tek güvenilir
  // kanıtı, görünür satırların tamamının arama anahtarını içermesidir.
  function filterCommitted(grid, colIndex, searchKey) {
    const rows = visibleRows(grid);
    if (rows.length === 0) return false;

    const key = normalize(searchKey);
    return rows.every(row => normalize(rowBankName(row, colIndex)).includes(key));
  }

  // Filtreyi uygular ve YALNIZ commit doğrulandıktan sonra aday değerlendirir.
  // DevExtreme input'u kendi state'inden geri yazarsa (önceki bankanın geç
  // commit'i) değer sapması görülür ve filtre taze node üzerinde yeniden uygulanır.
  async function applyFilterAndWaitForExactRow(searchKey, expectedTarget, timeoutMs, m) {
    const started = Date.now();
    let lastApply = 0;

    let lastReopen = 0;
    let missStreak = 0;

    while (Date.now() - started < timeoutMs) {
      const grid = findBankSelectGrid();
      const parts = grid ? getGridParts(grid) : null;

      if (!parts) {
        // Popup kapanmış olabilir. Pasif beklemek onu geri getirmez; yalnız
        // yeniden açmak getirir. DevExtreme uygulanmış filtreyi korur.
        missStreak += 1;

        if (missStreak >= 3 && Date.now() - lastReopen > 1200) {
          lastReopen = Date.now();
          m.reopenCount = (m.reopenCount || 0) + 1;
          await ensureBankGridOpen();
        } else {
          await sleep(80);
        }
        continue;
      }

      missStreak = 0;

      if (parts.filterInput.value !== searchKey) {
        if (Date.now() - lastApply > 900) {
          setFilter(parts.filterInput, searchKey);
          lastApply = Date.now();
          m.applyCount = (m.applyCount || 0) + 1;
        }
      } else if (filterCommitted(grid, parts.colIndex, searchKey)) {
        const candidates = exactCandidateRows(expectedTarget);
        if (candidates.length === 1) return candidates[0];
        if (candidates.length > 1) return null;
      }

      await sleep(80);
    }

    return null;
  }

  function selectedTargetCount(expectedTarget) {
    const editor = findBankSelectEditor();
    if (!editor) return 0;

    const expectedCanonical = canonical(expectedTarget);

    return editor.input.value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
      .filter(name => canonical(name) === expectedCanonical)
      .length;
  }

  async function waitUntilSelected(expectedTarget, timeoutMs = 1500) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const count = selectedTargetCount(expectedTarget);
      if (count === 1) return true;
      if (count > 1) return false;

      await sleep(60);
    }

    return false;
  }

  async function waitUntilGridReset(timeoutMs = 3000) {
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const grid = findBankSelectGrid();
      const parts = getGridParts(grid);

      if (grid && parts &&
          parts.filterInput.value === '' &&
          visibleRows(grid).length > 1) {
        return true;
      }

      await sleep(60);
    }

    return false;
  }

  function clearCurrentFilter() {
    const grid = findBankSelectGrid();
    const parts = getGridParts(grid);
    if (parts) setFilter(parts.filterInput, '');
  }

  async function selectOneBank(sourceName) {
    const m = {};
    const done = ok => { m.ok = ok; return m; };

    const grid = await ensureBankGridOpen();
    if (!grid) return done(false);

    const parts = getGridParts(grid);
    if (!parts) return done(false);

    const expectedTarget = targetFor(sourceName);
    const searchKey = searchFor(sourceName, expectedTarget);

    const alreadySelected = selectedTargetCount(expectedTarget);
    if (alreadySelected > 0) return done(alreadySelected === 1);

    m.applyCount = 0;
    m.reopenCount = 0;

    const row = await applyFilterAndWaitForExactRow(
      searchKey, expectedTarget, FILTER_BUDGET_MS, m
    );
    if (!row) return done(false);

    const checkbox = row.querySelector(
      '.dx-select-checkbox[role="checkbox"][aria-label="Satırı seç"]'
    );
    if (!checkbox) return done(false);

    if (checkbox.getAttribute('aria-checked') !== 'true') {
      checkbox.click();
    }

    const selected = await waitUntilSelected(expectedTarget, 1500);
    if (!selected) return done(false);

    // Seçimin kanıtı Banka Seç editor'ündeki tam canonical addır. Grid reset
    // yalnız bir sonraki banka için yumuşak bekleme; başarıyı bloke etmez.
    await waitUntilGridReset(3000);

    return done(true);
  }

  // =========================================================================
  // BÖLÜM 2 - SAYFA KAPSAMI VE GENEL YARDIMCILAR
  // =========================================================================

  const textOf = el =>
    (el?.innerText ?? el?.textContent ?? '').replace(/\s+/g, ' ').trim();

  // Dosya detayı bir popup içinde açılır. Arka plandaki "Dosya Sorgulama"
  // ekranında da "Sorgula" gibi aynı adlı düğmeler bulunduğundan, form
  // öğeleri DAİMA bu kapsam içinde aranır.
  function fileRoot() {
    const panes = [...document.querySelectorAll('.dosya-sorgula-popup .dx-overlay-content')]
      .filter(isVisible);
    return panes[panes.length - 1] || document;
  }

  const inRoot = selector => [...fileRoot().querySelectorAll(selector)].filter(isVisible);

  // Açılır liste seçenekleri gövde düzeyinde ayrı bir katmanda çizilir.
  const findOption = label =>
    [...document.querySelectorAll('[role="option"]')]
      .filter(isVisible)
      .find(el => textOf(el) === label) || null;

  const findTab = label =>
    inRoot('[role="tab"]').find(el => textOf(el) === label) || null;

  const findRadio = label =>
    inRoot('[role="radio"]').find(el => textOf(el) === label) || null;

  const findActionButton = label =>
    inRoot('[role="button"]')
      .find(el => (el.getAttribute('aria-label') || textOf(el)) === label) || null;

  function findEditorByPlaceholder(placeholder) {
    const input = inRoot('input')
      .find(el => el.getAttribute('placeholder') === placeholder);
    if (!input) return null;

    const editor =
      input.closest('.dx-dropdowneditor') ||
      input.closest('.dx-selectbox') ||
      input.closest('.dx-texteditor');
    if (!editor) return null;

    return {
      input,
      button: editor.querySelector('.dx-dropdowneditor-button') || editor
    };
  }

  async function waitFor(produce, timeoutMs, intervalMs = 120) {
    const started = Date.now();

    do {
      const value = produce();
      if (value) return value;
      await sleep(intervalMs);
    } while (Date.now() - started < timeoutMs);

    return null;
  }

  // UYAP'ın "Yükleniyor..." perdesi (dx-loadpanel). Bir sorgu kartına
  // tıklandığında dosya bilgileri ilgili kuruma gönderilir ve bu sırada perde
  // açılır. Ölçüm (2026-09-10, dört kart): şerit ve Sorgula düğmesi tıklamadan
  // 7-170 ms sonra çiziliyor, perde ise ondan SONRA, 160-220 ms'de açılıp
  // 360-510 ms'de kapanıyor; gerçek kişi borçluda kimlik bilgisi alınırken
  // saniyelerce sürebiliyor. Perde gerçek tıklamayı engeller ama programatik
  // tıklamayı engellemez: eskiden Sorgula'ya perde daha açılmadan basılıyor,
  // sorgu hazırlık bitmeden gidiyor ve EGM "TC kimlik bilgileri alınamadı"
  // diyor, TAKBİS ise uzun süre takılıyordu.
  //
  // Perde ayrı bir katmanda ve konumu değişebildiğinden (fixed/absolute)
  // offsetParent'a değil çizilen alana bakılır.
  const LOADER_SELECTOR = '.dx-loadpanel-wrapper, .dx-loadpanel-content';

  function loaderShown() {
    for (const el of document.querySelectorAll(LOADER_SELECTOR)) {
      if (!el.isConnected || el.classList.contains('dx-state-invisible')) continue;

      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return true;
    }
    return false;
  }

  // Perde açılıp kapanması beklenen yerlerde üst sınır. Kurum yanıtı gecikirse
  // UYAP perdeyi açık tutuyor; sonsuza kadar beklemek yerine bölüm düşürülür.
  const LOADER_TIMEOUT_MS = 60000;

  // Bir düğmeye basmadan hemen önce: o an perde açıksa kapanması beklenir,
  // kapandıktan sonra sayfanın kendine gelmesi için kısa bir pay bırakılır.
  // Perde yoksa hiç beklemez; sık çağrıldığı yerlerde (kayıt ekleme) akışı
  // yavaşlatmaz.
  async function waitForLoaderGone() {
    if (!loaderShown()) return;

    const started = Date.now();
    while (loaderShown()) {
      if (Date.now() - started > LOADER_TIMEOUT_MS) fail('Sayfadaki yükleme göstergesi kapanmadı');
      await sleep(50);
    }
    await sleep(150);
  }

  // Bir karta tıklandıktan sonra: perde GEÇ açıldığı için yalnız "şu an perde
  // yok" demek yetmez; graceMs boyunca hiç perde görülmeyene kadar beklenir.
  // Perde açılırsa kapanması, kapandıktan sonra da yine graceMs sessizlik
  // beklenir.
  //
  // Perde kısa sürdüğünde (kurum yanıtı beklenmeyen, yalnız çizimden ibaret
  // hazırlıkta) 50 ms'lik yoklama arasına sığıp kaçabiliyor; DOM her
  // değiştiğinde de bakılır ki o an bile "meşgul" sayılsın.
  async function waitForPageQuiet(graceMs) {
    const started = Date.now();
    let busyAt = Date.now();

    const observer = new MutationObserver(() => {
      if (loaderShown()) busyAt = Date.now();
    });
    observer.observe(document.body, {
      childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style']
    });

    try {
      while (true) {
        if (loaderShown()) busyAt = Date.now();
        else if (Date.now() - busyAt >= graceMs) return;

        if (Date.now() - started > LOADER_TIMEOUT_MS) fail('Sayfadaki yükleme göstergesi kapanmadı');
        await sleep(50);
      }
    } finally {
      observer.disconnect();
    }
  }

  // Kart tıklamasından sonra beklenen sessizlik. Ölçülen en geç perde açılışı
  // 217 ms; yavaş makine ve ağ payıyla geniş tutulur.
  const CARD_SETTLE_MS = 1000;

  // Bilgilendirme kutuları (ör. "60 dakikada 1 defa yapılabilir") tek düğmelidir
  // ve kapatılabilir. İki düğmeli gerçek bir onay sorusuna ASLA dokunulmaz;
  // böyle bir durumda otomasyon durur.
  function dismissInfoAlert() {
    const popup = document.querySelector('.swal2-container .swal2-popup');
    if (!isVisible(popup)) return 'none';

    const buttons = [...popup.querySelectorAll('.swal2-actions button')].filter(isVisible);
    const confirm = popup.querySelector('.swal2-confirm');

    if (buttons.length !== 1 || !confirm) return 'blocked';

    confirm.click();
    return 'dismissed';
  }

  const alertVisible = () =>
    isVisible(document.querySelector('.swal2-container .swal2-popup'));

  // Kutunun GÖVDE metni okunur. Sorgunun neden yapılamadığını kullanıcıya
  // söyleyebilmenin başka yolu yok: engel neredeyse her zaman böyle bir kutuyla
  // bildiriliyor. Bunlar UYAP'ın sistem mesajlarıdır (limit, ücret, bakiye);
  // taraf adı, dosya numarası gibi bilgi taşımazlar. Başlık ve düğme etiketleri
  // dışarıda bırakılır, uyarı simgesinin "!" metni de gövdeye girmez.
  function alertMessage() {
    const popup = document.querySelector('.swal2-container .swal2-popup');
    if (!isVisible(popup)) return '';

    return textOf(popup.querySelector('.swal2-html-container')) ||
           textOf(popup.querySelector('.swal2-title'));
  }

  // Sorguyu bitiren, beklemenin bir şey değiştirmeyeceği engeller. Eşleşen
  // yoksa boş döner: o zaman kutunun kendi cümlesi olduğu gibi gösterilir,
  // yani liste kapalı değildir.
  function describeBlock(message) {
    const flat = normalize(message);

    if (flat.includes('60 DAKİKADA')) return 'Bu sorgu 60 dakikada bir yapılabiliyor';
    if (flat.includes('BAKİYE')) return 'Sorgu bakiyeniz yetersiz';
    if (flat.includes('LİMİT')) return 'Sorgu limitiniz dolmuş';
    if (flat.includes('YETKİ')) return 'Bu sorgu için yetkiniz yok';
    if (flat.includes('KURUMLAR İÇİN')) return 'Bu sorgu kurum borçlularda yapılamıyor';

    // "Bu sorgu türü, 09:00-10:00 ve 15:00-16:00 saatleri arasında
    // yapılamamaktadır." TAKBİS'te çıkıyor. Saat penceresi kapanana kadar
    // beklemenin anlamı yok; tanınmadığı için akış boşuna bekliyordu.
    if (flat.includes('SAATLERİ ARASINDA') ||
        flat.includes('SAATLER DIŞINDA')) return 'Bu sorgu şu saatlerde yapılamıyor';

    return '';
  }

  // "Sorgular" sekmesindeki kartlar (Banka, EGM-TNB, TAKBİS, İcra Dosyası ...)
  // ve tıklanınca altlarında açılan şerit. Şerit, sorgunun ne yaptığını yazar
  // ve o sorgunun kendi "Sorgula" düğmesini taşır. Aynı anda yalnız bir kartın
  // şeridi açıktır, bu yüzden düğme DAİMA şeridin içinden alınır: ekrandaki
  // tek Sorgula düğmesi, açık olan başka bir kartın düğmesi olabilir.
  const findQueryCard = title =>
    inRoot('button.query-button')
      .find(el => textOf(el.querySelector('.info-card--main-title')) === title) || null;

  const findQueryPanel = panelText =>
    inRoot('.alert')
      .find(el => normalize(textOf(el)).includes(normalize(panelText))) || null;

  function findQuerySorgulaButton(panelText) {
    const button = findQueryPanel(panelText)
      ?.querySelector('[role="button"][aria-label="Sorgula"]');
    return isVisible(button) ? button : null;
  }

  // Sorgu kartları dosya penceresindeki "Sorgular" sekmesinin altındadır.
  // Akış başka bir sekmede duruyorsa (ör. bir önceki bölümün bıraktığı Talep
  // Gönder ekranında ya da kullanıcı elle başka bir sekmeye geçtiyse) kartlar
  // ekranda hiç olmaz ve sorgu "bölüm açılmadı" diye düşerdi. Bu yüzden her
  // sorgudan önce sekmeye dönülür. Sekme zaten seçiliyse TIKLANMAZ: seçili
  // sekmeye yeniden tıklamak o an açık olan sorgu şeridini kapatabilir.
  const SORGULAR_TAB = 'Sorgular';

  const tabSelected = tab =>
    tab.getAttribute('aria-selected') === 'true' ||
    tab.classList.contains('dx-tab-selected');

  // Beklenen, "herhangi bir kart" değil TAM O KART'tır. Sekme açılır açılmaz
  // kartların hepsi birden çizilmiyor: ekran geldiği hâlde aranan kart birkaç
  // yüz milisaniye sonra oluşabiliyor. Eskiden bu ara anda kart aranıp
  // bulunamıyor ve akış hiç sorgu yapmadan "bölüm açılmadı" ile duruyordu.
  //
  // Ayrıca sayfa meşgulken bir tıklama sessizce yutulabiliyor. Bu yüzden hem
  // sekme hem kart, sonucun ekrana gelmesi beklenerek birkaç kez denenir.
  async function ensureQueryScreen(cardTitle) {
    const ready = () => !!findQueryCard(cardTitle);

    if (ready()) return;

    for (let attempt = 0; attempt < 3; attempt++) {
      const tab = findTab(SORGULAR_TAB);

      // Sekme bu ekranda başka bir adla duruyorsa kartın görünür olması
      // yeterli kanıttır; akış eskisi gibi sürer.
      if (!tab) {
        if (await waitFor(() => findTab(SORGULAR_TAB) || ready(), 2500)) continue;
        fail('Sorgular sekmesi bulunamadı');
      }

      // Seçili sekmeye yeniden tıklamak o an açık olan sorgu şeridini
      // kapatabilir; seçiliyse yalnız kartın çizilmesi beklenir.
      if (!tabSelected(tab)) {
        await waitForLoaderGone();
        tab.click();
      }

      if (await waitFor(ready, 4000)) return;
    }

    fail('Sorgular ekranı açılmadı');
  }

  // Kart açık değilse açar. Açıksa hiç tıklamaz: açık bir kartın kendisine
  // ikinci kez tıklamak şeridi kapatır. Her turun başında şerit yeniden
  // yoklanır ki geç açılan bir şerit ikinci tıklamayla kapatılmasın.
  //
  // Şeridin çizilmesi kartın hazır olduğu anlamına gelmez: UYAP şeridi hemen
  // çizer, dosya bilgilerini kuruma ondan sonra, perde açarak gönderir. Bu
  // yüzden şerit geldikten sonra bir de perdenin açılıp kapanması beklenir
  // (bkz. waitForPageQuiet). Sorgula düğmesine ancak ondan sonra basılabilir.
  async function openQueryCard(cardTitle, panelText, missingLabel) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (findQueryPanel(panelText)) return;

      const card = await waitFor(() => findQueryCard(cardTitle), 4000);
      if (!card) continue;

      await waitForLoaderGone();
      card.click();

      if (await waitFor(() => findQueryPanel(panelText), 5000)) {
        await waitForPageQuiet(CARD_SETTLE_MS);
        return;
      }
    }

    if (findQueryPanel(panelText)) return;

    // Kart hiç çizilmediyse bunu ayrıca söyle: "şerit açılmadı" ile aynı şey
    // değil ve bir sonraki sefer nereye bakılacağını belli eder.
    if (!findQueryCard(cardTitle)) fail(`${cardTitle} kartı ekranda bulunamadı`);

    fail(missingLabel);
  }

  // =========================================================================
  // BÖLÜM 3 - ADIMLAR
  // =========================================================================

  const send = message => {
    document.dispatchEvent(
      new CustomEvent(TO_EXT, { detail: JSON.stringify(message) })
    );
  };

  let stepIndex = 0;
  let stepTotal = 0;

  // Çalıştırma boyunca RAM'de tutulan banka listesi. Başlangıçta ve bitişte
  // (başarılı ya da başarısız) boşaltılır.
  let capturedBanks = [];

  // O anki bölümde ücret onay kutusuna basıldı mı. Toplu akışta bölüm
  // satırına "(ücretli)" notu düşmek için tutulur: kullanıcı hangi sorgunun
  // para harcadığını sonradan da görebilmeli.
  let paidApproved = false;

  function step(label) {
    stepIndex += 1;
    send({ t: 'STEP', label, index: stepIndex, total: stepTotal });
  }

  // İki tür duruş var:
  //
  //   fail(ipucu)          Beklenen bir öğe gelmedi. Popup'ta "Bir şeyler ters
  //                        gitti" yazar, altında NEREDE durulduğunu söyleyen
  //                        kısa ipucu görünür.
  //   blocked(neden, ...)  UYAP bir kutuyla engelledi. Bölüm satırına UYAP'ın
  //                        KENDİ cümlesi yazılır ("Uyarı: ..."). Buradaki
  //                        "neden", cümleyi tanıyıp beklemeyi kesmeye yarar;
  //                        satırda gösterilmez, yoksa aynı şey iki kez yazılmış
  //                        olurdu.
  //
  // Hiçbiri dosya/taraf bilgisi içermez.
  class StepError extends Error {
    constructor(detail, headline = '') {
      super(detail);
      this.detail = detail;
      this.headline = headline;
    }
  }

  const fail = detail => { throw new StepError(detail); };
  const blocked = (headline, detail) => { throw new StepError(detail, headline); };

  // --- Banka sorgusu --------------------------------------------------------

  // Banka da diğerleri gibi bir sorgu kartıdır; kartı ve şeridi ortak
  // yardımcılarla bulunur.
  const BANKA_CARD = 'Banka';
  const BANKA_PANEL = 'Banka bilgileri';

  const findBankaSorgulaButton = () => findQuerySorgulaButton(BANKA_PANEL);

  // Sayfalayıcı, DataGrid kökünün içinde ya da tablonun hemen yanındadır.
  // Yanlışlıkla başka bir tablonun sayfalayıcısına uzanmamak için kapsam dar
  // tutulur.
  function gridPager(grid) {
    for (const scope of [grid, grid.parentElement]) {
      const pager = scope?.querySelector('.dx-datagrid-pager, .dx-pager');
      if (isVisible(pager)) return pager;
    }
    return null;
  }

  // Sayfalayıcı "Sayfa 1 / 1 (7 Kayıt)" biçiminde toplam kayıt sayısı yazar.
  // DOM'daki satır sayısı bundan azsa tablo hâlâ sayfalanmıştır ve okunacak
  // liste eksik olur. Böyle bir durumda eksik talep hazırlamak yerine durulur.
  function sourceRowsIncomplete(grid) {
    const pager = gridPager(grid);
    const info = pager?.querySelector('.dx-info');
    const match = info && textOf(info).match(/\((\d+)/);
    if (!match) return false;

    return grid.querySelectorAll('tr.dx-data-row').length < Number(match[1]);
  }

  // Tablo sayfalanmış olabilir; hiçbir kayıt atlanmasın ve sayfa değiştirme
  // en aza insin diye önce sayfa boyutu en büyüğe ("Tümü" varsa ona) çekilir.
  // Tablo yeniden çizildiğinde eski düğüm elden gidebildiğinden kök değil,
  // onu bulan işlev alınır.
  async function expandGridPages(findGrid) {
    const pager = gridPager(findGrid() || document.body);
    if (!pager) return;

    const sizes = [...pager.querySelectorAll('.dx-page-size')].filter(isVisible);
    if (sizes.length < 2) return;

    const all = sizes.find(el => /^(tümü|all)$/i.test(textOf(el)));
    const target = all || sizes.reduce((best, el) =>
      (parseInt(textOf(el), 10) || 0) > (parseInt(textOf(best), 10) || 0) ? el : best
    );

    if (!target || target.classList.contains('dx-selection')) return;

    const label = textOf(target);
    target.click();

    // Seçimin kanıtı, şeritteki işaretin hedef boyuta geçmesidir.
    await waitFor(() => {
      const grid = findGrid();
      const current = grid && gridPager(grid)?.querySelector('.dx-page-size.dx-selection');
      return current && textOf(current) === label;
    }, 6000);

    await sleep(400);
  }

  // allowPaid yalnız toplu akışta ve kullanıcı tikini açtıysa true gelir.
  async function stepQueryBanks(allowPaid = false) {
    step('Banka sorgusu açılıyor');

    // Sorgu kartları yalnız "Sorgular" sekmesinde durur.
    await ensureQueryScreen(BANKA_CARD);

    if (findSourceGrid()) {
      // Kullanıcı sorguyu zaten yaptıysa 60 dakikalık limite takılmamak için
      // yeniden sorgulanmaz.
      step('Banka sorgulanıyor');
    } else {
      // Başka bir sorgu kartı (EGM, TAKBİS ...) açıkken de banka kartı açılır.
      await openQueryCard(BANKA_CARD, BANKA_PANEL, 'Banka bölümü açılmadı');

      step('Banka sorgulanıyor');

      const sorgula = findBankaSorgulaButton();
      if (!sorgula) fail('Sorgula düğmesi bulunamadı');

      // Şerit akış başlamadan önce zaten açıksa kartın perdesi hâlâ dönüyor
      // olabilir; perde açıkken basılmaz.
      await waitForLoaderGone();
      sorgula.click();

      // Sonuç tablosu, ücret onayı ya da (limit gibi) bir bilgilendirme kutusu
      // bekleniyor.
      let outcome = await waitFor(() => {
        if (findSourceGrid()) return 'grid';
        if (findFeeDialog()) return 'fee';
        if (alertVisible()) return 'alert';
        return null;
      }, 30000);

      // Ücret kutusuna yalnız açıkça izin verildiyse basılır; izin yoksa
      // dokunulmaz ve kararı kullanıcı verir.
      if (outcome === 'fee') {
        const fee = findFeeDialog();
        // Ücret kutusunun cümlesi tutarı içerir; sonuna neden geçildiği
        // eklenir, çünkü bunu UYAP değil eklenti karar veriyor.
        if (!allowPaid) {
          blocked('Bu sorgu ücretli', `${fee.message} (ücretli sorgu onayı kapalı)`);
        }

        paidApproved = true;
        fee.confirm.click();
        await waitFor(() => !findFeeDialog(), 5000);

        outcome = await waitFor(() => {
          if (findSourceGrid()) return 'grid';
          if (alertVisible()) return 'alert';
          return null;
        }, 40000);
      }

      if (outcome === 'alert') {
        const message = alertMessage();
        const reason = describeBlock(message);

        dismissInfoAlert();
        await sleep(800);

        // Engel belliyse tabloyu beklemenin anlamı yok.
        if (reason) blocked(reason, message);
        if (!findSourceGrid() && message) blocked('Sorgu yapılamadı', message);
      }

      if (!findSourceGrid()) fail('Banka sorgusu sonuç vermedi');
    }

    step('Banka listesi alınıyor');

    await expandGridPages(findSourceGrid);
    if (sourceRowsIncomplete(findSourceGrid())) fail('Banka listesi eksik geldi');

    const banks = readBanks();
    if (!banks || banks.size === 0) fail('Banka kaydı bulunamadı');

    // Liste hem çalıştırma boyunca RAM'de tutulur hem de eklentinin geçici
    // belleğine (chrome.storage.session) yazılır. Seçim adımı ikisini de
    // kabul eder; böylece mesaj gidiş-dönüşündeki bir aksaklık işlemi
    // yarıda bırakmaz.
    capturedBanks = [...banks];
    send({ t: 'SAVE_BANKS', banks: capturedBanks });
    await sleep(300);
  }

  // --- Talep formu ----------------------------------------------------------

  async function openDropdownAndPick(editor, optionLabel) {
    if (!editor) return false;

    editor.button.click();

    const option = await waitFor(() => findOption(optionLabel), 10000);
    if (!option) return false;

    option.click();
    return true;
  }

  async function stepOpenTalepForm() {
    step('Talep gönder açılıyor');

    const tab = findTab('Talep Gönder');
    if (!tab) fail('Talep Gönder sekmesi bulunamadı');
    await waitForLoaderGone();
    tab.click();

    if (!await waitFor(() => findEditorByPlaceholder('Talep Tipi Seçiniz'), 12000)) {
      fail('Talep tipi alanı gelmedi');
    }

    step('Talep tipi seçiliyor');

    if (!await openDropdownAndPick(
      findEditorByPlaceholder('Talep Tipi Seçiniz'), 'Haciz Talepleri'
    )) fail('Haciz Talepleri seçilemedi');

    if (!await waitFor(() => findEditorByPlaceholder('Talep Türü Seçiniz'), 12000)) {
      fail('Talep türü alanı gelmedi');
    }

    step('Talep türü seçiliyor');

    if (!await openDropdownAndPick(
      findEditorByPlaceholder('Talep Türü Seçiniz'), 'Banka Haczi Talebi'
    )) fail('Banka Haczi Talebi seçilemedi');

    if (!await waitFor(() => findEditorByPlaceholder('Banka Seçiniz'), 15000)) {
      fail('Banka Seç alanı gelmedi');
    }
  }

  // --- Banka seçimi ---------------------------------------------------------

  function requestBanks() {
    const reqId = String(Date.now()) + Math.random().toString(36).slice(2);

    return new Promise(resolve => {
      const timer = setTimeout(() => {
        document.removeEventListener(TO_PAGE, listener);
        resolve([]);
      }, 5000);

      function listener(event) {
        let message;
        try {
          message = JSON.parse(event.detail);
        } catch (_) {
          return;
        }
        if (message.t !== 'BANKS' || message.reqId !== reqId) return;

        clearTimeout(timer);
        document.removeEventListener(TO_PAGE, listener);
        resolve(message.banks || []);
      }

      document.addEventListener(TO_PAGE, listener);
      send({ t: 'GET_BANKS', reqId });
    });
  }

  async function closeBankGrid() {
    clearCurrentFilter();
    await sleep(350);

    for (let attempt = 0; attempt < 3; attempt++) {
      if (!findBankSelectGrid()) return true;

      const editor = findBankSelectEditor();
      if (!editor) return true;

      editor.button.click();

      const started = Date.now();
      while (Date.now() - started < 2000) {
        if (!findBankSelectGrid()) return true;
        await sleep(80);
      }
    }
    return !findBankSelectGrid();
  }

  async function stepSelectBanks() {
    const stored = await requestBanks();
    const banks = stored.length > 0 ? stored : capturedBanks;
    if (banks.length === 0) fail('Banka listesi belleğe alınamadı');

    stepIndex += 1;

    let done = 0;
    try {
      for (const sourceName of banks) {
        done += 1;
        send({
          t: 'STEP',
          label: `Bankalar seçiliyor (${done}/${banks.length})`,
          index: stepIndex,
          total: stepTotal
        });

        const result = await selectOneBank(sourceName);
        if (!result.ok) fail(`Banka seçilemedi (${done}/${banks.length})`);

        await sleep(120);
      }
    } finally {
      // Başarısızlıkta da açık kalan liste ekranı kapatılır.
      await closeBankGrid();
    }

    return banks.length;
  }

  // --- Hesap türleri, ihbarname, talep --------------------------------------

  const findAccountGrid = () =>
    [...document.querySelectorAll('.dx-datagrid')]
      .filter(isVisible)
      .find(grid =>
        grid.querySelector('td[role="columnheader"][aria-label="Sütun Hesap Türü"]')
      ) || null;

  async function stepSelectAccountTypes() {
    step('Hesap türleri seçiliyor');

    const editor = findEditorByPlaceholder('Hesap Seçiniz');
    if (!editor) fail('Hesap Seç alanı bulunamadı');

    editor.button.click();

    const grid = await waitFor(findAccountGrid, 12000);
    if (!grid) fail('Hesap türü listesi açılmadı');

    // "Hesap Türü" başlığının solundaki tik: tüm hesap türlerini seçer.
    const selectAll = grid.querySelector(
      '.dx-select-checkbox[role="checkbox"][aria-label="Hepsini seç"]'
    );
    if (!selectAll) fail('Hesap türü tiki bulunamadı');

    if (selectAll.getAttribute('aria-checked') !== 'true') {
      selectAll.click();
    }

    // Seçimin kanıtı, editor alanının dolmuş olmasıdır.
    if (!await waitFor(() => {
      const current = findEditorByPlaceholder('Hesap Seçiniz');
      return current && current.input.value.trim().length > 0;
    }, 6000)) fail('Hesap türleri seçilemedi');

    // Açık liste alttaki seçenekleri kapattığı için kapatılır.
    const closer = findEditorByPlaceholder('Hesap Seçiniz');
    if (closer && findAccountGrid()) {
      closer.button.click();
      await waitFor(() => !findAccountGrid(), 3000);
    }
  }

  // Radyo düğmesini seçer ve GERÇEKTEN seçildiğini doğrular. Bir önceki
  // adımdan kalan kutu kapanırken sayfa ilk tıklamayı yutabildiği için
  // doğrulama tutmazsa bir kez daha denenir.
  async function selectRadio(label, errorLabel) {
    if (!await waitFor(() => findRadio(label), 10000)) fail(errorLabel);

    for (let attempt = 0; attempt < 2; attempt++) {
      const radio = findRadio(label);
      if (!radio) break;

      if (radio.getAttribute('aria-checked') === 'true') return;

      radio.click();

      if (await waitFor(
        () => findRadio(label)?.getAttribute('aria-checked') === 'true', 2500
      )) return;
    }

    fail(errorLabel);
  }

  async function stepSelectIhbarname() {
    step('89/1 haciz ihbarnamesi seçiliyor');
    await selectRadio('89/1 Haciz İhbarnamesi', '89/1 işaretlenemedi');
  }

  const findEvrakOlusturButton = () =>
    inRoot('button[aria-label="download"]')
      .find(el => /talep evrakı oluştur/i.test(textOf(el))) || null;

  async function stepAddTalep() {
    step('Talep ekleniyor');

    const button = findActionButton('Talep Ekle');
    if (!button) fail('Talep Ekle düğmesi bulunamadı');
    await waitForLoaderGone();
    button.click();

    // UYAP "Talep eklendi." kutusunu açar (tek düğmeli, başarı ikonlu).
    // Kutu bir süre sonra kendiliğinden kapanır; beklemek sonraki adımları
    // gereksiz geciktirdiği için görünür görünmez "Tamam" ile kapatılır.
    // Kutu, evrak düğmesinden ÖNCE yoklanır: ikisi aynı anda belirdiğinde
    // önce evrak düğmesine bakılırsa kutu hiç kapatılmadan geçilirdi.
    const outcome = await waitFor(() => {
      if (alertVisible()) return 'alert';
      if (findEvrakOlusturButton()) return 'hazir';
      return null;
    }, 25000);

    if (outcome === 'alert') {
      if (dismissInfoAlert() !== 'dismissed') fail('Onay kutusu kapatılamadı');
      await waitFor(() => !alertVisible(), 4000);
    }

    if (!await waitFor(findEvrakOlusturButton, 20000)) fail('Talep eklenemedi');
  }

  async function stepCreateDocument() {
    step('Talep evrakı oluşturuluyor');

    const button = findEvrakOlusturButton();
    if (!button) fail('Talep evrakı düğmesi bulunamadı');

    await waitForLoaderGone();
    button.click();

    // Burada çoğu zaman kutu çıkmaz. Çıkmayacak bir kutuyu beklemek boşuna
    // gecikme olduğu için pencere kısa tutulur; ayrıca programatik tıklama
    // swal2 perdesinden etkilenmediğinden sonraki adım kutu açıkken bile
    // başlayabilir.
    if (await waitFor(alertVisible, 700)) dismissInfoAlert();
  }

  // =========================================================================
  // BÖLÜM 3B - SORGU HACİZLERİ (EGM / İCRA DOSYASI / TAKBİS)
  // =========================================================================
  //
  // Üç akış da aynı iskelete oturur: sorgu kartını aç, sorgula, sonuç
  // tablosundaki her satırı "Haciz Talebine Ekle" ile talebe ekle, ardından
  // Talep Gönder sekmesine geç. Bu haciz türlerinde yukarıdaki talep tipi /
  // talep türü alanları doldurulmaz ve ödeme adımı yoktur.
  //
  // Tek fark EGM'dedir: orada araç başına "Haciz Şerhi" penceresi açılır ve
  // "Haciz" işaretlenmeden talep eklenmez. Pencerenin çıkıp çıkmadığı sabit
  // varsayılmaz, her satırda yerinde bakılır.

  const QUERY_FLOWS = {
    egm: {
      key: 'egm', label: 'EGM', card: 'EGM-TNB', panel: 'EGM-TNB',
      empty: 'Araç kaydı yok'
    },
    icra: {
      key: 'icra', label: 'İcra dosyası', card: 'İcra Dosyası', panel: 'İcra Dosyası',
      empty: 'İcra dosyası kaydı yok'
    },
    takbis: {
      key: 'takbis', label: 'TAKBİS', card: 'TAKBİS', panel: 'TAKBİS',
      empty: 'Taşınmaz kaydı yok'
    }
  };

  // Borçlunun kaydı yoksa sonuç tablosu HİÇ gelmez; onun yerine sonuç
  // belgesine "Kişiye ait taşınmaz kaydı yok." gibi tek satırlık bir cümle
  // düşer. Yalnız tabloyu beklemek, olmayacak bir şeyi dakikalarca beklemek
  // demekti. Kurum borçlularda "Kişiye" yerine "Kuruma" yazdığı ve her sorguda
  // araç/taşınmaz/dosya kelimesi değiştiği için cümlenin yalnız değişmeyen
  // sonuna bakılır.
  // normalize() metni tr-TR'ye göre büyütür, noktalamayı boşluğa çevirir ve
  // boşlukları teke indirir; kalıp bu düzleştirilmiş metinde aranır.
  //
  // Cümle, sorgu değişince ekrandan hemen kalkmıyor. Toplu akışta bu, sırası
  // gelen sorgunun HİÇ YAPILMADAN atlanmasına yol açıyordu: bir önceki
  // sorgunun "...kaydı yok" cümlesi ekranda durduğu için TAKBİS de kayıtsız
  // sanılıyordu. Bu yüzden cümlenin kime ait olduğu da bakılır: hangi sorgunun
  // konuştuğu, KAYIT kelimesinin hemen öncesindeki birkaç kelimede yazar
  // ("Kişiye ait TAŞINMAZ kaydı yok").
  const EMPTY_RESULT = /((?:\S+\s+){0,4})KAY(?:DI|IT)\s+(?:YOK|BULUNAMADI|BULUNAMAMIŞTIR)/g;

  const EMPTY_OWNERS = {
    egm: /ARAÇ|PLAKA|TESCİL/,
    icra: /İCRA|DOSYA/,
    takbis: /TAŞINMAZ|TAPU|GAYRİMENKUL/
  };

  // Cümle her zaman dosya penceresinin içinde çizilmiyor: sorgu sonucu ayrı
  // bir belge çerçevesine düşebiliyor ve orada aranmadığı için bulunamıyordu.
  // Sonuç: icra dosyası kayıtsız çıktığında akış cümleyi göremeyip iki dakika
  // boşuna bekliyordu. Bu yüzden sayfanın tamamı ve aynı kaynaktan gelen
  // çerçeveler birlikte taranır. Metinden YALNIZ aşağıdaki cümle kalıbı
  // aranır; hiçbir alan okunmaz, saklanmaz, dışarı verilmez.
  function resultText() {
    const parts = [textOf(document.body)];

    for (const frame of document.querySelectorAll('iframe')) {
      if (!isVisible(frame)) continue;

      try {
        const body = frame.contentDocument?.body;
        if (body) parts.push(textOf(body));
      } catch (_) {
        // Başka kaynaktan gelen çerçeve okunamaz; sorun değil.
      }
    }
    return parts.join(' ');
  }

  // innerText sayfayı yeniden ölçtürdüğü için tarama seyreltilir: 120 ms'lik
  // yoklama temposunda sayfanın tamamını her turda okumak arayüzü ağırlaştırır.
  let lastScan = { at: 0, matches: [] };

  function noRecordSentences(force = false) {
    const now = Date.now();
    if (!force && now - lastScan.at < 500) return lastScan.matches;

    lastScan = { at: now, matches: [...normalize(resultText()).matchAll(EMPTY_RESULT)] };
    return lastScan.matches;
  }

  // baseline verilirse, sorgudan ÖNCE ekranda kaç cümle olduğunu söyler:
  // sayı arttıysa yeni cümle bu sorguya aittir. Kayıt adı tanınıyorsa cümle
  // zaten doğrudan sahibine bağlanır. İkisi de tutmuyorsa cümle başkasınındır
  // ve bu sorgu için "kayıt yok" sayılmaz.
  function queryReportedNoRecord(flowKey, baseline = -1) {
    const matches = noRecordSentences();

    if (baseline >= 0 && matches.length > baseline) return true;

    const mine = EMPTY_OWNERS[flowKey];
    return matches.some(match => mine.test(match[1] || ''));
  }

  // Ücretsiz sorgu hakkı bittiğinde UYAP "... ücret alınacaktır" diye İptal /
  // Tamam düğmeli bir kutu açar. Cümlesi tutarın kendisini içerdiği için
  // olduğu gibi kullanıcıya gösterilir; düğme etiketleri dışarıda kalsın diye
  // metin gövdeden okunur.
  function findFeeDialog() {
    const popup = [...document.querySelectorAll('.dx-overlay-content')]
      .filter(isVisible)
      .find(el => /ücret alınacaktır/i.test(textOf(el)));

    if (!popup) return null;

    const buttons = [...popup.querySelectorAll('.dx-button')].filter(isVisible);
    const confirm = buttons.find(el => el.getAttribute('aria-label') === 'Tamam');
    const cancel = buttons.find(el => el.getAttribute('aria-label') === 'İptal');

    if (!confirm || !cancel) return null;

    const message = textOf(popup.querySelector('.dx-popup-content')) || textOf(popup);

    return { confirm, cancel, message };
  }

  // Sonuç tablosu, sütun başlıklarına göre değil satırlarındaki ekleme
  // düğmesine göre tanınır: üç sorgunun sütunları birbirinden tamamen farklı,
  // düğmesi ise aynıdır.
  const findHacizGrid = () =>
    [...fileRoot().querySelectorAll('.dx-datagrid')]
      .filter(isVisible)
      .find(grid =>
        grid.querySelector('[role="button"][aria-label="Haciz Talebine Ekle"]')
      ) || null;

  const hacizAddButtons = grid =>
    [...grid.querySelectorAll('tr.dx-data-row [role="button"][aria-label="Haciz Talebine Ekle"]')]
      .filter(isVisible);

  // Şerh penceresi dosya penceresinin dışında, ayrı bir katmanda çizilir.
  const findSerhPopup = () =>
    [...document.querySelectorAll('.dx-overlay-content')]
      .filter(isVisible)
      .find(el => textOf(el.querySelector('.dx-popup-title')) === 'Haciz Şerhi') || null;

  // Sayfalayıcı "Sayfa 1 / 2 (137 Kayıt)" biçiminde toplam kayıt sayısı yazar.
  function gridRecordCount(grid) {
    const info = grid && gridPager(grid)?.querySelector('.dx-info');
    const match = info && textOf(info).match(/\((\d+)/);
    return match ? Number(match[1]) : 0;
  }

  // Sayfa boyutu en büyüğe çekilse de kayıt sayısı taşabilir. Çok sayfalı
  // listelerde sayfalayıcı araya "..." koyup yalnız bir pencere gösterir ve
  // şeridin son öğesi SON sayfadır; bu yüzden sıradaki sayfa konuma göre değil
  // numarasına göre aranır. Aksi hâlde beşinci sayfadan sonuncuya atlanabilir.
  async function goToNextPage() {
    const grid = findHacizGrid();
    const pager = grid && gridPager(grid);
    if (!pager) return false;

    const current = Number(textOf(pager.querySelector('.dx-page.dx-selection')));
    if (!current) return false;

    const label = String(current + 1);
    const target = [...pager.querySelectorAll('.dx-page')]
      .filter(isVisible)
      .find(el => textOf(el) === label);
    if (!target) return false;

    await waitForLoaderGone();
    target.click();

    const moved = await waitFor(() => {
      const next = findHacizGrid();
      const selected = next && gridPager(next)?.querySelector('.dx-page.dx-selection');
      return selected && textOf(selected) === label;
    }, 8000);

    if (!moved) fail('Sonraki sayfaya geçilemedi');

    await sleep(600);
    return true;
  }

  // Satırdaki düğmeye basıldıktan sonrasını yürütür: varsa haciz şerhi
  // penceresi, ardından "Talep eklendi." kutusu.
  async function completeAdd() {
    const outcome = await waitFor(() => {
      if (findSerhPopup()) return 'serh';
      if (alertVisible()) return 'alert';
      return null;
    }, 25000);

    if (!outcome) fail('Talep eklenemedi');

    if (outcome === 'serh') {
      const radio = [...findSerhPopup().querySelectorAll('[role="radio"]')]
        .find(el => textOf(el) === 'Haciz');
      if (!radio) fail('Haciz şerhi seçeneği bulunamadı');

      if (radio.getAttribute('aria-checked') !== 'true') radio.click();

      const checked = await waitFor(() => {
        const popup = findSerhPopup();
        const el = popup && [...popup.querySelectorAll('[role="radio"]')]
          .find(item => textOf(item) === 'Haciz');
        return el?.getAttribute('aria-checked') === 'true';
      }, 3000);
      if (!checked) fail('Haciz şerhi işaretlenemedi');

      const add = [...findSerhPopup()
        .querySelectorAll('[role="button"][aria-label="Haciz Talebine Ekle"]')]
        .filter(isVisible)[0];
      if (!add) fail('Şerh penceresindeki düğme bulunamadı');

      add.click();

      if (!await waitFor(alertVisible, 25000)) fail('Talep eklenemedi');
    }

    // "Talep eklendi." kutusu bir süre sonra kendiliğinden de kapanır; erken
    // kapanmışsa kapatacak bir şey kalmaz ve bu bir hata değildir. İki düğmeli
    // gerçek bir soru çıkarsa dokunulmaz ve durulur.
    if (dismissInfoAlert() === 'blocked') fail('Beklenmeyen onay kutusu');
    await waitFor(() => !alertVisible(), 5000);
  }

  async function stepOpenQuery(flow) {
    step(`${flow.label} sorgusu açılıyor`);

    // Sorgu kartları yalnız "Sorgular" sekmesinde durur.
    await ensureQueryScreen(flow.card);

    // Panel bu akış için zaten açıksa ekrandaki sonuç da bu akışa aittir.
    if (findQueryPanel(flow.panel)) return;

    await openQueryCard(flow.card, flow.panel, 'Sorgu bölümü açılmadı');

    // Sonuç tabloları sütunlarıyla değil satırlarındaki ekleme düğmesiyle
    // tanındığı için üç sorgunun tablosu birbirine benzer. Kart değişince
    // önceki sorgunun tablosu ekrandan silinir; silinmesi beklenmezse o tablo
    // bu akışın sonucu sanılır ve başka bir haciz türünün kayıtları yeniden
    // eklenirdi. Bölümler birbirinden bu bekleme ile ayrılır.
    if (!await waitFor(() => !findHacizGrid(), 8000)) {
      fail('Önceki sorgu sonucu ekrandan kalkmadı');
    }
  }

  // Kayıt çıkmadıysa 'empty' döner; çağıran akış orada durur.
  async function stepRunQuery(flow, allowPaid) {
    step(`${flow.label} sorgulanıyor`);

    // Kullanıcı sorguyu zaten yaptıysa yeniden sorgulanmaz: sorgular sayılı ve
    // hak bittiğinde ücretlidir.
    if (findHacizGrid()) return 'grid';
    if (queryReportedNoRecord(flow.key)) return 'empty';

    const sorgula = findQuerySorgulaButton(flow.panel);
    if (!sorgula) fail('Sorgula düğmesi bulunamadı');

    // Bir önceki sorgunun "...kaydı yok" cümlesi ekranda kalabiliyor. Tıklamadan
    // önceki sayı not edilir ki sonradan düşen cümle onunkinden ayrılabilsin.
    const baseline = noRecordSentences(true).length;

    // Şerit akış başlamadan önce zaten açıksa kartın perdesi hâlâ dönüyor
    // olabilir; perde açıkken basılmaz.
    await waitForLoaderGone();
    sorgula.click();

    // Sonuç tablosu, "kayıt yok" cümlesi, ücret onayı ya da bir bilgilendirme
    // kutusu bekleniyor. Ücret onaylandıktan sonra sırayla birkaçı birden
    // çıkabildiği için birkaç tur dönülür.
    let lastMessage = '';

    // Uzun bekleme yalnız SORGUNUN KENDİSİ için: ilk turda ve ücret onayından
    // sonra sorgu yeniden çalışır, cevabı gelene kadar beklenir. Tanımadığımız
    // bir bilgilendirme kutusundan sonra ise UYAP zaten cevabını vermiştir;
    // arkasından bir tablo gelecekse hemen gelir. Eskiden orada da 40 saniye
    // bekleniyordu ve TAKBİS'in saat uyarısı gibi bir kutuda akış dakikalarca
    // asılı kalıyordu.
    let queryRunning = true;

    for (let round = 0; round < 3; round++) {
      const outcome = await waitFor(() => {
        if (findHacizGrid()) return 'grid';
        if (queryReportedNoRecord(flow.key, baseline)) return 'empty';
        if (findFeeDialog()) return 'fee';
        if (alertVisible()) return 'alert';
        return null;
      }, queryRunning ? 40000 : 8000);

      if (outcome === 'grid') return 'grid';
      if (outcome === 'empty') return 'empty';
      if (!outcome) break;

      if (outcome === 'fee') {
        const fee = findFeeDialog();

        // İzin verilmediyse kutuya hiç dokunulmaz: kararı kullanıcı verir.
        // Tutarı da içerdiği için UYAP'ın kendi cümlesi gösterilir; sonuna
        // neden geçildiği eklenir, çünkü buna UYAP değil eklenti karar veriyor.
        if (!allowPaid) {
          blocked('Bu sorgu ücretli', `${fee.message} (ücretli sorgu onayı kapalı)`);
        }

        paidApproved = true;
        fee.confirm.click();
        await waitFor(() => !findFeeDialog(), 5000);

        // Onaydan sonra sorgu baştan çalışıyor: yine uzun beklenir.
        queryRunning = true;
        continue;
      }

      const message = alertMessage();
      const reason = describeBlock(message);

      // Kutu her hâlükârda kapatılır; ekranda asılı bırakılmaz.
      if (dismissInfoAlert() !== 'dismissed') fail('Onay kutusu kapatılamadı');
      await waitFor(() => !alertVisible(), 4000);

      // Engel belliyse beklemenin bir şeyi değiştirmeyeceğini biliyoruz.
      if (reason) blocked(reason, message);

      queryRunning = false;
      if (message) lastMessage = message;
    }

    if (findHacizGrid()) return 'grid';
    if (queryReportedNoRecord(flow.key, baseline)) return 'empty';

    // Tanımadığımız bir kutu çıktıysa da kullanıcı en azından UYAP'ın ne
    // dediğini görsün.
    if (lastMessage) blocked('Sorgu yapılamadı', lastMessage);

    fail(`${flow.label} sorgusu sonuç vermedi`);
  }

  async function stepAddAllToTalep(flow) {
    step(`${flow.label} kayıtları hazırlanıyor`);

    if (!findHacizGrid()) fail('Sonuç tablosu bulunamadı');

    await expandGridPages(findHacizGrid);

    const total = gridRecordCount(findHacizGrid());
    if (total === 0) fail('Sorguda kayıt bulunamadı');

    stepIndex += 1;
    let done = 0;

    while (true) {
      const count = hacizAddButtons(findHacizGrid()).length;

      for (let index = 0; index < count; index++) {
        const grid = findHacizGrid();
        if (!grid) fail('Sonuç tablosu kayboldu');

        // Düğmeler her eklemeden sonra yeniden çizilebildiği için sıradaki
        // düğme taze düğümler arasından alınır.
        const buttons = hacizAddButtons(grid);
        if (buttons.length !== count) fail('Sonuç listesi değişti');

        done += 1;
        send({
          t: 'STEP',
          label: `Haciz talebine ekleniyor (${done}/${total})`,
          index: stepIndex,
          total: stepTotal
        });

        await waitForLoaderGone();
        buttons[index].click();
        await completeAdd();
        await sleep(200);
      }

      if (!await goToNextPage()) break;
    }

    // Sayfalayıcının söylediği sayıya ulaşılamadıysa eksik bir talep hazırlanmış
    // olur; bunu sessizce geçmek yerine durulur.
    if (done < total) fail(`Kayıtların tamamı eklenemedi (${done}/${total})`);

    return done;
  }

  async function stepOpenQueryTalepForm() {
    step('Talep gönder açılıyor');

    const tab = findTab('Talep Gönder');
    if (!tab) fail('Talep Gönder sekmesi bulunamadı');
    await waitForLoaderGone();
    tab.click();

    // Talep tipi / türü seçilmez; hazır olmanın kanıtı talep evrakı düğmesidir.
    if (!await waitFor(findEvrakOlusturButton, 20000)) fail('Talep gönder ekranı gelmedi');
  }

  // =========================================================================
  // BÖLÜM 4 - ÇALIŞTIRMA
  // =========================================================================

  let running = false;

  // --- Toplu haciz ----------------------------------------------------------
  //
  // Eklentinin tek akışı: popup'ta tikli bırakılan haciz türleri sırayla
  // hazırlanır. Seçenekler tür tikleri ve ücret onayıdır:
  //
  //   - Tiki kaldırılan tür hiç sorgulanmaz, satırı da listeye düşmez.
  //   - Sorgu bölümlerinde kayıtlar yalnız haciz talebine eklenir. Talep
  //     evrakı oluşturulmaz, evrak türü seçilmez, Talep Gönder sekmesine de
  //     geçilmez: hepsi en sondaki tek evrak adımında toplanır.
  //   - Banka bölümü, seçim sırası ne olursa olsun DAİMA en son çalışır:
  //     talep formunu o açar ve sorgu bölümlerinin eklediği kayıtlar da aynı
  //     evrakta toplanır. Ödeme türü ve evrak türü girilmez.
  //   - Akış her hâlükârda talep evrakı adımıyla biter.
  //   - Bir bölüm yarıda kalırsa akış durmaz: ekranda kalan kutu kapatılır,
  //     ne olduğu o bölümün satırına yazılır ve sıradaki bölüme geçilir.

  const BULK_QUERIES = ['egm', 'icra', 'takbis'];
  const BULK_TYPES = [...BULK_QUERIES, 'banka'];

  // Bölüm satırları popup'ta ortak durum kutucuğunun altında ayrı bir liste
  // olarak görünür. Her satır bir cümleyle ne olduğunu söyler: kaç kayıt
  // eklendi, neden eklenmedi, nerede takıldı.
  const stage = (key, name, state, note = '') =>
    send({ t: 'STAGE', key, name, state, note });

  // Ücret onaylanmışsa nota eklenir: hangi bölümün para harcadığı görünsün.
  const withCost = note => (paidApproved ? `${note} (ücretli sorgu onaylandı)` : note);

  // Bölüm satırına yazılacak cümle. UYAP kendi kutusuyla engellediyse YALNIZ o
  // kutunun cümlesi gösterilir; onu bir de kendi sözlerimizle özetlemek satırı
  // uzatıyor ve aynı şeyi iki kez söylüyordu.
  function stopNote(error) {
    if (!(error instanceof StepError)) return 'Bir şeyler ters gitti';
    if (error.headline && error.detail) return `Uyarı: ${error.detail}`;
    return error.headline || error.detail || 'Bir şeyler ters gitti';
  }

  // Yarıda kalan bölümden ekranda bir kutu kalabilir; sıradaki bölüm o kutunun
  // altında hiçbir şeye tıklayamaz. Burada YALNIZ "vazgeç" anlamına gelen
  // düğmelere basılır: ücret onayında İptal, şerh penceresinde kapat, tek
  // düğmeli bilgi kutusunda Tamam, iki düğmeli swal kutusunda varsa İptal.
  // Kapatılamayan bir kutu çıkarsa false döner ve akış orada durur.
  async function clearOverlays() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const fee = findFeeDialog();
      if (fee) {
        fee.cancel.click();
        await waitFor(() => !findFeeDialog(), 4000);
        continue;
      }

      const serh = findSerhPopup();
      if (serh) {
        // Escape tuşu bu sayfada dosya penceresini tamamen kapattığı için
        // kullanılmaz; pencere yalnız kendi kapatma düğmesiyle kapatılır.
        const close = serh.querySelector(
          '.dx-closebutton, .dx-icon-close, [aria-label="Kapat"], [aria-label="Close"]'
        );
        if (!isVisible(close)) return false;

        close.click();
        await waitFor(() => !findSerhPopup(), 4000);
        continue;
      }

      if (alertVisible()) {
        const popup = document.querySelector('.swal2-container .swal2-popup');
        const cancel = popup.querySelector('.swal2-cancel');
        const button = isVisible(cancel) ? cancel : popup.querySelector('.swal2-confirm');
        if (!isVisible(button)) return false;

        button.click();
        await waitFor(() => !alertVisible(), 4000);
        continue;
      }

      // Açık kalmış banka listesi de sonraki bölümün önünü kapatır.
      if (findBankSelectGrid()) {
        await closeBankGrid();
        continue;
      }

      return true;
    }
    return false;
  }

  // Sorgu bölümünün toplu akıştaki hâli: kartı aç, sorgula, çıkan kayıtların
  // hepsini haciz talebine ekle. Kaç kayıt eklendiğini ve bölümün satırına
  // yazılacak notu döndürür.
  async function runBulkQuery(flow, allowPaid) {
    await stepOpenQuery(flow);

    // Kayıt çıkmaması hata değildir; eklenecek bir şey yoktur.
    if (await stepRunQuery(flow, allowPaid) === 'empty') {
      return { added: 0, note: withCost(flow.empty) };
    }

    const added = await stepAddAllToTalep(flow);
    return { added, note: withCost(`${added} kayıt haciz talebine eklendi`) };
  }

  // Talep evrakı, banka bölümünün İÇİNDE değil, en sonda ayrı bir adım olarak
  // oluşturulur. Kurum borçlularda banka sorgusu hiç yapılamıyor ("Kurumlar
  // için bu sorgu yapılamamaktadır"); evrak banka adımına bağlı kaldığında,
  // EGM ve TAKBİS'ten eklenen talepler evraksız kalıyordu.
  //
  // Bu adım bölüm listesine satır DÜŞMEZ: evrak, bölümlerden biri değil işin
  // sonucudur ve durum kutucuğunun altında, başlığın hemen altında yazılır.
  // Döndürdüğü not oraya gider.
  async function runBulkDocument(prepared) {
    if (prepared === 0) {
      return {
        ok: true,
        note: 'Talebe eklenen kayıt olmadığı için evrak oluşturulmadı'
      };
    }

    try {
      // Banka bölümü Talep Gönder ekranında bittiyse sekme zaten açıktır.
      if (!findEvrakOlusturButton()) await stepOpenQueryTalepForm();

      await stepCreateDocument();

      // Geç açılan tek düğmeli bir kutu kapatılır. İki düğmeli gerçek bir soru
      // çıktıysa evrak inmemiş olabilir; buna "oluşturuldu" demek yerine
      // durum söylenir.
      if (alertVisible() && dismissInfoAlert() === 'blocked') {
        fail('Talep evrakı için beklenmeyen onay kutusu çıktı');
      }

      return { ok: true, note: `${prepared} kayıt için talep evrakı oluşturuldu` };
    } catch (error) {
      await clearOverlays();
      return { ok: false, note: `Talep evrakı oluşturulamadı: ${stopNote(error)}` };
    }
  }

  async function runBulkFlow(allowPaid, types) {
    // Türler popup'tan gelir. Eski bir popup'tan tür listesi hiç gelmezse
    // akış eskisi gibi dördünü de çalıştırır.
    const chosen = Array.isArray(types) && types.length > 0 ? types : BULK_TYPES;

    // Sıra burada belirlenir, kullanıcının tikleme sırası değil: banka bölümü
    // talep formunu açtığı için daima en sonda çalışmalıdır.
    const queries = BULK_QUERIES.filter(key => chosen.includes(key));
    const withBanka = chosen.includes('banka');

    // Her sorgu bölümü 4 adım (kart, sorgu, hazırlık, kayıt sayacı), banka
    // bölümü 10 adım. Evrak bölümü normalde 2 adımdır; banka bölümü Talep
    // Gönder ekranında bittiği için o sekmeyi açma adımı orada düşer.
    stepTotal = queries.length * 4 + (withBanka ? 11 : 2);

    let failed = 0;

    // Haciz talebine kaç kayıt girdiği: evrak adımının çalışıp çalışmayacağına
    // bu karar verir.
    let prepared = 0;

    // Bitişte gösterilecek özet için bölüm başına kayıt sayısı.
    const counts = [];

    for (const key of queries) {
      const flow = QUERY_FLOWS[key];
      stage(key, flow.label, 'running', 'Sorgulanıyor');
      paidApproved = false;

      try {
        const result = await runBulkQuery(flow, allowPaid);
        prepared += result.added;
        counts.push(`${flow.label} ${result.added}`);
        stage(key, flow.label, 'done', result.note);
      } catch (error) {
        failed += 1;
        stage(key, flow.label, 'error', stopNote(error));

        // Kapatılamayan bir kutu sıradaki bölümü de kesin olarak engeller;
        // körlemesine devam etmek yerine burada durulur.
        if (!await clearOverlays()) fail('Ekrandaki kutu kapatılamadı');
      }
    }

    if (withBanka) {
      stage('banka', 'Banka', 'running', 'Sorgulanıyor');
      paidApproved = false;

      try {
        await stepQueryBanks(allowPaid);
        await stepOpenTalepForm();

        const selected = await stepSelectBanks();

        await stepSelectAccountTypes();
        await stepSelectIhbarname();
        await stepAddTalep();

        prepared += selected;
        counts.push(`Banka ${selected}`);
        stage('banka', 'Banka', 'done', withCost(
          `${selected} banka için 89/1 haciz talebi eklendi`
        ));
      } catch (error) {
        failed += 1;
        stage('banka', 'Banka', 'error', stopNote(error));
        await clearOverlays();
      }
    }

    const evrak = await runBulkDocument(prepared);
    if (!evrak.ok) failed += 1;

    // Başlığın altındaki satır: evrakın ne olduğu ve hangi bölümden kaçar
    // kayıt geldiği. Bir bölüm takıldığında da aynı satır yazılır; nedeni
    // zaten o bölümün kendi satırında durur.
    const detail = counts.length > 0
      ? `${evrak.note} (${counts.join(', ')})`
      : evrak.note;

    // Bir bölüm bile eksik kaldıysa durum yeşile dönmez: hazırlanan talep
    // eksiktir ve kullanıcının bunu fark etmesi gerekir.
    if (failed > 0) blocked(`${failed} bölüm tamamlanamadı`, detail);

    return { label: 'Tamamlandı', detail };
  }

  async function run(options) {
    if (running) return;
    running = true;

    stepIndex = 0;
    capturedBanks = [];
    paidApproved = false;

    try {
      const result = await runBulkFlow(options.paid === true, options.types);

      send({ t: 'DONE', label: result.label, detail: result.detail });
    } catch (error) {
      const stop = error instanceof StepError ? error : null;
      send({ t: 'FAIL', label: stop?.headline || '', detail: stop?.detail || '' });
    } finally {
      capturedBanks = [];
      running = false;
    }
  }

  // --- Başka dosyaya geçildiğinde özeti temizle -----------------------------
  //
  // Toplu haciz bittikten sonra bölüm listesi popup'ta duruyor; başka bir dosya
  // açıldığında da orada kalıyor ve önceki dosyanın özeti yeni dosyanınmış gibi
  // okunabiliyordu. Dosyanın değiştiği, içinden hiçbir bilgi okunmadan
  // anlaşılabilir: dosya penceresi kapandığında ya da yerine yenisi
  // çizildiğinde DOM düğümü başkalaşır. Burada YALNIZ o düğümün kimliği
  // karşılaştırılır; dosya numarası, taraf adı, borçlu seçimi okunmaz.
  const currentFileWindow = () =>
    [...document.querySelectorAll('.dosya-sorgula-popup .dx-overlay-content')]
      .filter(isVisible)
      .pop() || null;

  let watchedFileWindow = currentFileWindow();
  let pendingChange = null;

  const watcher = setInterval(() => {
    // Eklenti yenilendiyse bu kopya çekilir; iki izleyici birden dönmesin.
    if (!isCurrent()) {
      clearInterval(watcher);
      return;
    }

    // Çalışma sürerken temizlenmez: canlı liste o çalışmanın kendisidir.
    if (running) return;

    const open = currentFileWindow();

    if (open === watchedFileWindow) {
      pendingChange = null;
      return;
    }

    // UYAP pencereyi geçici olarak yeniden çizerse özet silinmesin:
    // değişikliğin iki turda da sürmesi beklenir.
    if (pendingChange !== open) {
      pendingChange = open;
      return;
    }

    watchedFileWindow = open;
    pendingChange = null;
    send({ t: 'RESET' });
  }, 1500);

  document.addEventListener(TO_PAGE, event => {
    if (!isCurrent()) return;

    let message;
    try {
      message = JSON.parse(event.detail);
    } catch (_) {
      return;
    }
    if (message.t === 'START') run(message);
  });
})();
