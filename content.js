// UYAP Haciz Yardımcısı - sayfa tarafı otomasyonu (MAIN dünya).
//
// MAHREMİYET: Bu betik yalnız aşağıdakileri okur:
//   - düğme / sekme / seçenek etiketleri,
//   - "No / Kurum" tablosundaki BANKA kurum adları (bütün sayfalar),
//   - Banka Seç (bütün sayfalar) ve Hesap Seç listelerindeki satır adları,
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

  // --- Durdurma ---------------------------------------------------------------
  //
  // Popup'taki durdurma düğmesi akışı olduğu yerde keser. Akış, sayfayı yoklayan
  // beklemelerden (sleep, waitFor) oluşur. Kesme de oralarda yapılır. İstek
  // gelince bekleyen her uyku hemen uyanır ve StopRequest fırlatır. Hata,
  // bölümlerin "takıldı, sıradakine geç" yakalayıcılarından geçerken yeniden
  // fırlatılır: akış sıradaki bölüme geçmeden biter (bkz. run). Tıklamalardan
  // hemen önceki bekleme de isteğe bakar, istekten sonra sayfaya yeni bir
  // tıklama gitmez.
  class StopRequest extends Error {
    constructor() {
      super('Durduruldu');
    }
  }

  let stopRequested = false;
  const wakers = new Set();

  function requestStop() {
    stopRequested = true;
    for (const wake of [...wakers]) wake();
  }

  function throwIfStopped() {
    if (stopRequested) throw new StopRequest();
  }

  function sleep(ms) {
    if (stopRequested) return Promise.reject(new StopRequest());

    return new Promise((resolve, reject) => {
      const wake = () => {
        clearTimeout(timer);
        wakers.delete(wake);
        if (stopRequested) reject(new StopRequest());
        else resolve();
      };
      const timer = setTimeout(wake, ms);
      wakers.add(wake);
    });
  }
  // offsetParent yalnız display:none olan öğeleri eler. DevExtreme sekme
  // panelleri ise seçili olmayan sekmenin içeriğini silmez, visibility:hidden
  // verip ekran dışına iter. Ölçüm (2026-09-21): Talep Gönder'deki No / Kurum
  // tablosu Sorgular sekmesindeyken de offsetParent taşıyordu; iki tablo birden
  // "görünür" sayılıyor, sayfalar yanlış tablodan okunabiliyordu. Böyle bir
  // öğeye tıklanamaz da; görünmez sayılır.
  const isVisible = el =>
    !!el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';

  // =========================================================================
  // BÖLÜM 1 - BANKA EŞLEŞTİRME ÇEKİRDEĞİ (v1'den alınmıştır)
  // Bu bölümün mantığı ve zamanlaması saha ölçümleriyle oturmuştur. 2.13'te
  // yalnız ad eşlemesi değişti: elle tutulan tablo yerine Banka Seç listesinin
  // kendisine bakılıyor. Filtreleme, seçim ve bekleme süreleri aynıdır.
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

  // --- Sorgu sonucundaki adı Banka Seç listesindeki unvana bağlama ----------
  //
  // Sorgu sonucundaki kurum adları Banka Seç listesindeki resmî unvanla
  // yazılmıyor. Eskiden elle tutulan bir eşleme tablosu vardı; kurum
  // borçlularda ise aynı banka tek listede birkaç biçimde geliyor ve tablo
  // yetmiyordu. Ölçüm (2026-09-21, kurum borçlu, 135 satır, 16 yazım, 9 banka):
  //   - 20 harfte kesilmiş:  "YAPI VE KREDİ BANKAS", "TURKIYE GARANTI BAN"
  //   - Türkçe harfsiz:      "TURKIYE GARANTI BANKASI A.S.", "DENIZBANK A.S."
  //   - kısaltmalı:          "T.C. Ziraat Bankası Genel Mdr", "TÜRKİYE VAKIFLAR BANKASI TAO",
  //                          "ALBARAKA TÜRK KATILIM BNK A.Ş."
  //   - bitişik yazılmış:    "KUVEYTTÜRK ..."   (listede "KUVEYT TÜRK ...")
  //   - listede önekli:      "ASYA KATILIM BANKASI" (listede "MÜFLİS ASYA ...")
  //
  // Bu yüzden önce Banka Seç listesinin TAMAMI okunur, her ad oradaki tek bir
  // unvana bağlanır. Karşılaştırma harf farkına, boşluğa, noktalamaya ve şirket
  // ekine bakmaz. Hiçbir unvana ya da birden çok unvana uyan bir ad çıkarsa
  // tahmin yürütülmez: o ad işaretlenmeden atlanır, adıyla uyarıya düşer ve
  // eşleşen bankalarla devam edilir (bkz. resolveBanks). Eşleşen ad kalmazsa
  // banka bölümü durur.

  const ASCII_LETTERS = { Ç: 'C', Ğ: 'G', İ: 'I', Ö: 'O', Ş: 'S', Ü: 'U' };

  // Unvanın başında durup bankayı değiştirmeyen sözcükler.
  const LEADING_NOISE = [['MUFLIS'], ['TASFIYE', 'HALINDE']];

  // Sondaki şirket ekleri ve merkez adları. Uzun olan önce denenir: "T A S",
  // "A S"den önce gelmezse "AKBANK T" kalırdı.
  const TRAILING_NOISE = [
    ['GENEL', 'MUDURLUGU'], ['GENEL', 'MUDURLUK'], ['GENEL', 'MDR'], ['GENEL', 'MD'],
    ['TURK', 'ANONIM', 'ORTAKLIGI'], ['TURK', 'ANONIM', 'SIRKETI'],
    ['ANONIM', 'ORTAKLIGI'], ['ANONIM', 'SIRKETI'],
    ['T', 'A', 'S'], ['T', 'A', 'O'], ['TAS'], ['TAO'],
    ['A', 'S'], ['A', 'O'], ['AS'], ['AO']
  ];

  // Resmî unvanı hiç anmayan, marka olarak yerleşmiş adlar. Anahtar ve değer
  // bankForms().core biçimindedir.
  const BRAND_ALIASES = new Map([
    ['YAPIKREDI', 'YAPIVEKREDIBANKASI'],
    ['YAPIKREDIBANKASI', 'YAPIVEKREDIBANKASI'],
    ['GARANTIBBVA', 'TURKIYEGARANTIBANKASI'],
    ['VAKIFBANK', 'TURKIYEVAKIFLARBANKASI'],
    ['TEB', 'TURKEKONOMIBANKASI'],
    ['FINANSBANK', 'QNBBANK'],
    ['QNBFINANSBANK', 'QNBBANK']
  ]);

  const startsWithWords = (words, prefix) =>
    prefix.length <= words.length && prefix.every((word, i) => words[i] === word);

  const endsWithWords = (words, suffix) =>
    suffix.length < words.length &&
    suffix.every((word, i) => words[words.length - suffix.length + i] === word);

  // İki biçim döner, ikisi de boşluksuz yazılır ("KUVEYTTÜRK" = "KUVEYT TÜRK"):
  //   full: harfleri düzleştirilmiş, kısaltmaları açılmış tam ad
  //   core: aynı ad, sondaki şirket eki ve "Genel Müdürlüğü" atılmış
  // full ayrıca tutulur, çünkü 20 harfte kesilmiş bir ad şirket ekinin
  // ortasında bitebilir ("AKBANK TÜRK ANONİM Ş").
  function bankForms(value) {
    let words = normalize(value)
      .replace(/[ÇĞİÖŞÜ]/g, ch => ASCII_LETTERS[ch])
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Z0-9]+/g, ' ')
      .trim()
      .split(' ')
      .filter(Boolean);

    for (const noise of LEADING_NOISE) {
      if (startsWithWords(words, noise) && words.length > noise.length) {
        words = words.slice(noise.length);
      }
    }

    if (startsWithWords(words, ['T', 'C'])) words = ['TURKIYE', 'CUMHURIYETI', ...words.slice(2)];
    else if (words[0] === 'TC') words = ['TURKIYE', 'CUMHURIYETI', ...words.slice(1)];

    words = words.map(word => (word === 'BNK' ? 'BANKASI' : word));

    const full = words.join('');

    let stripped = true;
    while (stripped) {
      stripped = false;
      for (const noise of TRAILING_NOISE) {
        if (endsWithWords(words, noise)) {
          words = words.slice(0, words.length - noise.length);
          stripped = true;
          break;
        }
      }
    }

    // starts: core içinde her sözcüğün başladığı yer (bkz. matchBankTiered).
    const starts = [];
    let at = 0;
    for (const word of words) {
      starts.push(at);
      at += word.length;
    }

    return { full, core: words.join(''), starts };
  }

  // targets: Banka Seç listesinden okunmuş [{ name, full, core }].
  // Uyan unvanları döndürür; çağıran taraf yalnız TEK sonucu kabul eder.
  // Katmanlar sırayla denenir, ilk sonuç veren katmanda durulur:
  //   1. aynı ad,
  //   2. kesilmiş ad (unvanın başı),
  //   3. baştan ya da sondan bir parçası eksik ya da fazla ad
  //      ("ZİRAAT BANKASI", "HALKBANK", "... KIZILAY ŞUBESİ").
  //
  // 3. katmanda parça öbür adın bir SÖZCÜĞÜNÜN başından başlamalıdır. Adlar
  // boşluksuz karşılaştırıldığından eskiden sözcük ortasına denk gelen parça
  // da sayılıyordu: "T. FİNANS KATILIM BANKASI" (TFİNANS...) "HAYAT FİNANS
  // KATILIM BANKASI"na, "T. EMLAK BANKASI" (TEML-AKBANK-ASI) Akbank'a
  // uyuyordu. "HALKBANK" "TÜRKİYE HALK BANKASI"nda HALK sözcüğünün başından
  // başladığı için uymaya devam eder.
  //
  // UYAP 2026-11'den beri sorgu sonucunda "Türkiye"yi "T." diye kısaltıyor:
  // "T. VAKIFLAR BANKASI T.A.O.", "T. GARANTİ BANKASI A.Ş.", "T. İŞ BANKASI
  // A.Ş.", "T. HALK BANKASI A.Ş." (ölçüm 2026-11-12, Banka Seç listesinde
  // unvanlar "TÜRKİYE ..." diye tam yazılı). "T." "Türk" de olabilir ("Türk
  // Ekonomi Bankası"). Böyle bir ad üç biçimde denenir: olduğu gibi ("T.O.M.
  // KATILIM BANKASI" böyle uyar), "TÜRKİYE ..." ve "TÜRK ...". En sıkı
  // katmanda uyan biçimlerin unvanları döner. İki ayrı unvan kalırsa çağıran
  // taraf adı belirsiz sayar. "T.C." (Türkiye Cumhuriyeti) bankForms'ta açılır.
  function matchBank(sourceName, targets) {
    const forms = [sourceName];
    const name = normalize(sourceName);
    if (/^T (?!C )/.test(name)) forms.push(`TÜRKİYE ${name.slice(2)}`, `TÜRK ${name.slice(2)}`);

    let best = 0;
    const found = new Set();

    for (const form of forms) {
      const { tier, hits } = matchBankTiered(form, targets);
      if (tier === 0) continue;

      if (best === 0 || tier < best) {
        best = tier;
        found.clear();
      }
      if (tier === best) for (const hit of hits) found.add(hit);
    }
    return [...found];
  }

  const occursAtWordStart = (text, part, starts) =>
    starts.some(index => text.startsWith(part, index));

  // { tier, hits }: hits ilk sonuç veren katmanın unvanları, tier o katmanın
  // sırası (1-3). Hiçbir katman uymazsa tier 0.
  function matchBankTiered(sourceName, targets) {
    const source = bankForms(sourceName);
    const alias = BRAND_ALIASES.get(source.core);
    const key = alias || source.core;
    const keyStarts = alias ? [0] : source.starts;
    if (key.length < 3) return { tier: 0, hits: [] };

    const tiers = [
      target => target.core === key,
      target => target.core.startsWith(key) ||
                target.full.startsWith(key) ||
                target.full.startsWith(source.full),
      target => (key.length >= 6 && occursAtWordStart(target.core, key, target.starts)) ||
                (target.core.length >= 6 && occursAtWordStart(key, target.core, keyStarts))
    ];

    for (let i = 0; i < tiers.length; i++) {
      const hits = targets.filter(tiers[i]);
      if (hits.length > 0) return { tier: i + 1, hits };
    }
    return { tier: 0, hits: [] };
  }

  // Filtre kutusu metni olduğu gibi arar. Unvanın içinde noktalama varsa
  // ("T.O.M. KATILIM BANKASI", "S.P.A.") noktalamayı boşluğa çeviren
  // canonical() anahtarı hiçbir satırı bulamaz; o zaman unvanın kendisi,
  // yalnız şirket eki atılarak kullanılır. Noktalamasız unvanlarda anahtar
  // eskisiyle aynıdır.
  const RAW_SUFFIX = /\s+(?:TÜRK\s+)?ANONİM\s+(?:ŞİRKETİ|ORTAKLIĞI)\.?$|\s+(?:T\.?\s*)?A\.?\s*[ŞO]\.?$/;

  function searchKeyFor(target) {
    const key = canonical(target);
    const raw = String(target)
      .normalize('NFKC')
      .toLocaleUpperCase('tr-TR')
      .replace(/\s+/g, ' ')
      .trim();

    return raw.includes(key) ? key : raw.replace(RAW_SUFFIX, '').trim();
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

  // Tablonun O AN ekrandaki sayfasındaki satırlar: satır başına bir ad, boş
  // hücre boş dizgi olarak. Satır sayısı kayıt sayısıyla karşılaştırılacağı
  // için tekrarlar burada ayıklanmaz.
  function readBankRows() {
    const grid = findSourceGrid();
    if (!grid) return null;

    const kurumHeader = [...grid.querySelectorAll('tr.dx-header-row [role="columnheader"]')]
      .find(el => el.innerText.trim() === 'Kurum');

    const colIndex = kurumHeader?.getAttribute('aria-colindex');
    if (!colIndex) return null;

    return [...grid.querySelectorAll('tr.dx-data-row')].map(row =>
      row.querySelector(`td[role="gridcell"][aria-colindex="${colIndex}"]`)
        ?.innerText.trim() || ''
    );
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

  // expectedTarget, Banka Seç listesinden okunmuş TAM unvandır (bkz. matchBank).
  async function selectOneBank(expectedTarget) {
    const m = {};
    const done = ok => { m.ok = ok; return m; };

    const grid = await ensureBankGridOpen();
    if (!grid) return done(false);

    const parts = getGridParts(grid);
    if (!parts) return done(false);

    const searchKey = searchKeyFor(expectedTarget);

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

  // DevExtreme radyo düğmesinin etiketi. Eski sürümde role="radio" seçeneğin
  // kendisindeydi ve yazıyı içinde taşıyordu. UYAP'ın 2026-11'de geçtiği
  // sürümde role="radio" ile aria-checked yalnız yuvarlak işaretin kabında
  // (.dx-radio-value-container) duruyor. Yazı yanındaki .dx-item-content'te,
  // işarete aria-labelledby ile bağlı (ölçüm 2026-11-09, EGM'nin Haciz Şerhi
  // penceresi ve Talep Gönder'deki banka talep türü). İşaretin kendi yazısı
  // boş olduğu için "Haciz" bulunamıyordu.
  //
  // Etiket için birkaç aday okunur: aria-labelledby'nin gösterdiği her öğe tek
  // tek ve birlikte, seçeneğin bütünü, aria-label ve öğenin kendi yazısı.
  // Seçenek, adaylardan biri aranan etikete eşitse bulunmuş sayılır. Böylece
  // iki sürümde de, bağa bir grup başlığı eklense de sonuç aynıdır.
  function radioLabels(radio) {
    const labelled = (radio.getAttribute('aria-labelledby') || '')
      .split(/\s+/)
      .filter(Boolean)
      .map(id => textOf(document.getElementById(id)));

    return [
      ...labelled,
      labelled.filter(Boolean).join(' '),
      textOf(radio.closest('.dx-radiobutton')),
      (radio.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(),
      textOf(radio)
    ].filter(Boolean);
  }

  // Yeni sürümde aria-checked işaretin kabındadır, seçeneğin bütünü de
  // dx-radiobutton-checked sınıfını alır. Eski sürümde ikisi aynı öğedeydi.
  const radioChecked = radio =>
    radio.getAttribute('aria-checked') === 'true' ||
    !!radio.closest('.dx-radiobutton')?.classList.contains('dx-radiobutton-checked');

  const radioIn = (scope, label) =>
    [...scope.querySelectorAll('[role="radio"]')]
      .filter(isVisible)
      .find(el => radioLabels(el).includes(label)) || null;

  const findRadio = label => radioIn(fileRoot(), label);

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
      throwIfStopped();
      const value = produce();
      if (value) return value;
      await sleep(intervalMs);
    } while (Date.now() - started < timeoutMs);

    return null;
  }

  // Kaydı talebe ekleyen tıklamadan sonra sonucun gelmesi beklenir. Bu bekleme
  // durdurma isteğiyle kesilmez: Kesilseydi UYAP'ın eklediği kayıt özette
  // sayılmazdı. İstek, sonuç geldikten sonraki ilk beklemede yerine getirilir.
  async function waitForSettled(produce, timeoutMs, intervalMs = 120) {
    const started = Date.now();

    do {
      // Yerini yeni kopyaya bırakan kopya bekleyemez: Yeni çalıştırma aynı
      // sayfada başlamıştır, ikisi aynı kutulara dokunmasın (bkz. dosyanın sonu).
      if (!isCurrent()) throw new StopRequest();
      const value = produce();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, intervalMs));
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
    // Tıklamaların çoğu bu beklemenin hemen ardından gelir. Perde yokken hiç
    // uyumadığı için durdurma isteğine burada ayrıca bakılır.
    throwIfStopped();
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
    // Yerini yeni kopyaya bırakan kopya, yeni çalıştırmanın kutusunu kapatmasın.
    if (!isCurrent()) return 'none';

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

  // Çalıştırmanın kimliği. Arka plan her başlatmada yenisini verir ve
  // sayfadan gelen mesajı yalnız kimliği tutuyorsa yazar: durdurulmuş bir
  // akışın geç kalan mesajı yeni çalıştırmanın durumunu ezemez.
  let runId = '';

  const send = message => {
    // Yerini yeni kopyaya bırakmış kopya artık konuşmaz (bkz. dosyanın sonu).
    if (!isCurrent()) return;

    document.dispatchEvent(
      new CustomEvent(TO_EXT, { detail: JSON.stringify({ run: runId, ...message }) })
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

  // Banka Seç listesinde karşılığı bulunamadığı için atlanan kurumlar
  // ({ name, reason }). Banka bölümü sonradan takılsa da uyarı satırı
  // yazılabilsin diye eşleştirme adımının dışında, akışın belleğinde durur.
  let skippedBanks = [];

  // Sürmekte olan sorgu bölümünde o ana kadar talebe eklenen kayıt sayısı ve
  // talep evrakı düğmesine basılıp basılmadığı. Akış durdurulunca özet
  // bunlarla yazılır: yarıda kalan bölümün eklediği kayıtlar da talepte durur.
  let sectionAdded = 0;
  let documentRequested = false;

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

  // Sayfalayıcı "Sayfa 1 / 2 (137 Kayıt)" biçiminde toplam kayıt sayısı yazar.
  // Yazmıyorsa (Banka Seç listesi, sayfalanmayan küçük tablolar) 0 döner.
  function gridRecordCount(grid) {
    const info = grid && gridPager(grid)?.querySelector('.dx-info');
    const match = info && textOf(info).match(/\((\d+)/);
    return match ? Number(match[1]) : 0;
  }

  // Tablo yeniden çizildiğinde eski düğüm elden gidebildiğinden kök değil,
  // onu bulan işlev alınır. Sayfa zaten seçiliyse tıklanmaz. Sayfa şeritte
  // yoksa false döner; tıklandığı hâlde geçilemezse durulur.
  async function goToPage(findGrid, number) {
    const label = String(number);
    const grid = findGrid();
    const pager = grid && gridPager(grid);
    if (!pager) return false;

    if (textOf(pager.querySelector('.dx-page.dx-selection')) === label) return true;

    const target = [...pager.querySelectorAll('.dx-page')]
      .filter(isVisible)
      .find(el => textOf(el) === label);
    if (!target) return false;

    await waitForLoaderGone();

    const before = firstDataRow(grid);
    target.click();

    if (!await waitFor(() => rowsRedrawn(findGrid, before, label), 15000)) {
      fail('Sonraki sayfaya geçilemedi');
    }

    await waitForLoaderGone();
    await sleep(600);
    return true;
  }

  const firstDataRow = grid => grid?.querySelector('tr.dx-data-row') || null;

  // Şeritteki işaret tıklanır tıklanmaz yeni sayfaya geçer, satırlar ise
  // ondan sonra çizilir. Ölçüm (2026-09-21): işaret 2. sayfadayken tablo hâlâ
  // 1. sayfanın 100 satırını gösteriyordu ve aynı satırlar iki kez okundu
  // (200/135). Sekme arka plandayken Chrome çizimi daha da geciktiriyor. Bu
  // yüzden satırların yeniden çizildiği de beklenir. Bunun kanıtı ilk satırın
  // YENİ bir düğüm olmasıdır. Satırın içeriğine bakılmaz: EGM ve TAKBİS
  // tablolarında içerik okunmaz.
  function rowsRedrawn(findGrid, before, label) {
    const grid = findGrid();
    const selected = grid && gridPager(grid)?.querySelector('.dx-page.dx-selection');
    if (!selected || textOf(selected) !== label) return false;

    const first = firstDataRow(grid);
    return !!first && first !== before;
  }

  // Sayfa boyutu en büyüğe çekilse de kayıt sayısı taşabilir. Çok sayfalı
  // listelerde sayfalayıcı araya "..." koyup yalnız bir pencere gösterir ve
  // şeridin son öğesi SON sayfadır; bu yüzden sıradaki sayfa konuma göre değil
  // numarasına göre aranır. Aksi hâlde beşinci sayfadan sonuncuya atlanabilir.
  async function goToNextPage(findGrid) {
    const grid = findGrid();
    const pager = grid && gridPager(grid);
    if (!pager) return false;

    const current = Number(textOf(pager.querySelector('.dx-page.dx-selection')));
    if (!current) return false;

    return goToPage(findGrid, current + 1);
  }

  // Sorgu sonucundaki bankalar. Şahıs borçluda liste tek sayfaya sığıyor;
  // kurum borçluda aynı banka her hesap için ayrı satır olarak geliyor
  // (ölçüm: 135 satır). Sorgular sekmesindeki tabloda "Tümü" seçeneği yok, en
  // büyük sayfa 100 kayıt; eskiden bu yüzden "Banka listesi eksik geldi"
  // deniyordu. Artık bütün sayfalar tek tek okunur.
  //
  // Okunan satırların toplamı sayfalayıcının yazdığı kayıt sayısını tutmazsa
  // eksik talep hazırlamak yerine durulur. Dönen küme tekrarsızdır; aynı
  // bankanın farklı yazımları eşleştirme adımında birleşir.
  async function readSourceBanks() {
    await expandGridPages(findSourceGrid);

    const total = gridRecordCount(findSourceGrid());

    // Sayfa boyutu değişince tablo son sayfada kalabiliyor (ölçüldü: 50'den
    // 100'e geçince 2. sayfada kaldı); okuma daima baştan başlar.
    await goToPage(findSourceGrid, 1);

    const names = new Set();
    let rows = 0;

    do {
      const page = readBankRows();
      if (!page) fail('Banka listesi kayboldu');

      rows += page.length;
      for (const name of page) if (name) names.add(name);
    } while (await goToNextPage(findSourceGrid));

    if (total > 0 && rows !== total) fail(`Banka listesi tam okunamadı (${rows}/${total} satır)`);

    return names;
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
    const before = firstDataRow(findGrid());
    target.click();

    // Seçimin kanıtı, şeritteki işaretin hedef boyuta geçmesi ve satırların
    // yeniden çizilmesidir (bkz. rowsRedrawn).
    await waitFor(() => {
      const grid = findGrid();
      const current = grid && gridPager(grid)?.querySelector('.dx-page-size.dx-selection');
      const first = firstDataRow(grid);
      return current && textOf(current) === label && !!first && first !== before;
    }, 15000);

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

    const banks = await readSourceBanks();
    if (banks.size === 0) fail('Banka kaydı bulunamadı');

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

    // Ölçüm (2026-11-12): Sorgular'dan buraya geçilip tip ve tür yeniden
    // seçilince UYAP formu kısa süre sonra bir kez daha çiziyor, o sırada
    // açılan Banka Seç listesi yaklaşık 660 ms sonra kapanıyordu. 1,5 sn sonra
    // açılan liste kapanmadı. Bekleme yalnız yeniden denemeyi önler, okumanın
    // doğruluğunu readBankTargets'ın denetimleri sağlar.
    await sleep(1500);
  }

  // --- Banka seçimi ---------------------------------------------------------

  function requestBanks() {
    throwIfStopped();
    const reqId = String(Date.now()) + Math.random().toString(36).slice(2);

    return new Promise(resolve => {
      const finish = banks => {
        clearTimeout(timer);
        wakers.delete(wake);
        document.removeEventListener(TO_PAGE, listener);
        resolve(banks);
      };

      // Durdurma isteği yanıtı beklemeden bırakır (bkz. requestStop).
      const wake = () => finish([]);
      const timer = setTimeout(() => finish([]), 5000);

      function listener(event) {
        let message;
        try {
          message = JSON.parse(event.detail);
        } catch (_) {
          return;
        }
        if (message.t !== 'BANKS' || message.reqId !== reqId) return;

        finish(message.banks || []);
      }

      wakers.add(wake);
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

  // Banka Seç listesi de sayfalıdır (ölçüm 2026-09-21: sayfa başına 25, üç
  // sayfa, 58 banka. 2026-11-12'de de aynı). Eşleştirme listenin tamamına
  // bakmalıdır: İlk sayfada olmayan bir banka "listede yok" sanılırdı. Adlar
  // bütün sayfalardan okunur, ardından ilk sayfaya dönülür.
  //
  // Liste okunurken kendiliğinden kapanabilir. Ölçüm (2026-11-12): Sorgular
  // sekmesinden Talep Gönder'e geçilip talep tipi ve türü yeniden seçilince
  // hemen açılan liste yaklaşık 660 ms sonra kapanıyordu. Okuma o ana denk
  // gelince liste ya boş okunuyor ("Sorgudaki hiçbir kurum Banka Seç
  // listesinde bulunamadı") ya da "kayboldu" deniyordu. Daha kötüsü, liste
  // bir sayfa okunduktan sonra kapanırsa okunmayan sayfalardaki bankalar
  // sessizce "listede yok" diye atlanırdı. Bu yüzden okuma ancak liste baştan
  // sona açık kalmış, her sayfası dolu gelmiş ve sayfa sayısı değişmemişse
  // geçerlidir. Değilse liste yeniden açılıp baştan okunur.
  const BANK_LIST_ATTEMPTS = 3;

  async function readBankTargets() {
    let problem = '';

    for (let attempt = 1; attempt <= BANK_LIST_ATTEMPTS; attempt++) {
      if (attempt > 1) await sleep(1000);

      const result = await readBankListOnce();
      if (result.names) return [...result.names].map(name => ({ name, ...bankForms(name) }));
      problem = result.problem;
    }
    fail(problem);
  }

  // Sayfalayıcının gösterdiği en büyük sayfa numarası. Çok sayfada araya
  // "..." girse de son sayfa şeritte durur. Sayfalayıcı yoksa liste tek
  // sayfadır.
  function bankListPageCount(grid) {
    const pager = grid && gridPager(grid);
    if (!pager) return 1;

    const numbers = [...pager.querySelectorAll('.dx-page')]
      .map(el => Number(textOf(el)))
      .filter(n => Number.isInteger(n) && n > 0);
    return numbers.length > 0 ? Math.max(...numbers) : 1;
  }

  // goToPage gibi, ama liste kapanınca 15 sn beklemeden false döner.
  async function openBankListPage(number) {
    const label = String(number);
    const grid = findBankSelectGrid();
    if (!grid) return false;

    const pager = gridPager(grid);
    if (!pager) return number === 1;
    if (textOf(pager.querySelector('.dx-page.dx-selection')) === label) return true;

    const target = [...pager.querySelectorAll('.dx-page')]
      .filter(isVisible)
      .find(el => textOf(el) === label);
    if (!target) return false;

    await waitForLoaderGone();

    const before = firstDataRow(grid);
    target.click();

    const settled = await waitFor(
      () => !findBankSelectGrid() || rowsRedrawn(findBankSelectGrid, before, label),
      15000
    );
    if (!settled || !findBankSelectGrid()) return false;

    await waitForLoaderGone();
    await sleep(600);
    return !!findBankSelectGrid();
  }

  // Ekrandaki sayfanın adları. Liste kapalıysa null.
  function bankListPageNames() {
    const grid = findBankSelectGrid();
    const colIndex = grid && getGridParts(grid)?.colIndex;
    if (!colIndex) return null;

    return visibleRows(grid).map(row => rowBankName(row, colIndex)).filter(Boolean);
  }

  // Listeyi bir kez baştan sona okur: { names } ya da { problem }.
  async function readBankListOnce() {
    if (!await ensureBankGridOpen()) return { problem: 'Banka Seç listesi açılmadı' };

    // Önceki bir denemeden kalan süzgeç listeyi daraltır. Kutunun boşalması
    // süzgecin kalktığını göstermez: DevExtreme onu gecikmeli uygular (ilk
    // süzgeç ~3 sn, bkz. FILTER_BUDGET_MS). Ekrandaki satırların hepsi hâlâ
    // eski anahtarı taşıyorsa liste süzülmüş demektir, sayfalayıcısı da
    // süzülmüş listeninkidir. Bu yüzden satırlar değişene dek beklenir.
    const parts = getGridParts(findBankSelectGrid());
    if (parts && parts.filterInput.value !== '') {
      const oldKey = parts.filterInput.value;
      clearCurrentFilter();

      const cleared = await waitFor(() => {
        const grid = findBankSelectGrid();
        const now = grid && getGridParts(grid);
        return !!now && now.filterInput.value === '' &&
               visibleRows(grid).length > 0 &&
               !filterCommitted(grid, now.colIndex, oldKey);
      }, FILTER_BUDGET_MS);
      if (!cleared) return { problem: 'Banka Seç listesi süzgeci temizlenemedi' };
    }

    if (!await waitFor(() => bankListPageNames()?.length > 0, 5000)) {
      return { problem: 'Banka Seç listesi boş geldi' };
    }

    // Satırlar sayfalayıcıdan önce çizilebilir. Sayfalayıcı henüz yokken
    // liste tek sayfa sanılmasın diye kısa bir pay bırakılır. Sayfa sayısı
    // okumanın sonunda yeniden karşılaştırılır.
    await sleep(400);
    const pageCount = bankListPageCount(findBankSelectGrid());
    const names = new Set();

    for (let page = 1; page <= pageCount; page++) {
      if (!await openBankListPage(page)) return { problem: 'Banka Seç listesi kayboldu' };

      const pageNames = bankListPageNames();
      if (!pageNames) return { problem: 'Banka Seç listesi kayboldu' };
      if (pageNames.length === 0) return { problem: 'Banka Seç listesi boş geldi' };

      for (const name of pageNames) names.add(name);
    }

    if (!findBankSelectGrid()) return { problem: 'Banka Seç listesi kayboldu' };
    if (bankListPageCount(findBankSelectGrid()) !== pageCount) {
      return { problem: 'Banka Seç listesi okunurken değişti' };
    }

    await openBankListPage(1);
    return { names };
  }

  // Sorgu sonucundaki her adı tek bir unvana bağlar, aynı bankanın farklı
  // yazımlarını birleştirir. Bağlanamayan ad akışı DURDURMAZ: o kurum atlanır,
  // adı ve nedeni geri verilir, bölümün satırının altına uyarı olarak düşer.
  // Eskiden tek bir ad bağlanamayınca banka bölümünün tamamı hata veriyordu;
  // ölçüm (2026-09-22, kurum borçlu): Banka Seç listesinde karşılığı olmayan
  // "T.C.POSTA VE TELGRAF" yüzünden eşleşen bankaların talebi de
  // hazırlanmıyordu. Atlanan kurum adıyla yazılır ki kullanıcı elle
  // ekleyebilsin.
  function resolveBanks(sources, targets) {
    const chosen = [];
    const skipped = [];

    for (const source of sources) {
      const hits = matchBank(source, targets);

      if (hits.length === 0) {
        skipped.push({ name: source, reason: 'yok' });
        continue;
      }

      // Birden çok bankaya uyan ad da işaretlenmez: hangisi olduğu belli
      // değilken seçmek yanlış bankaya haciz göndermek olur.
      if (hits.length > 1) {
        skipped.push({ name: source, reason: 'belirsiz' });
        continue;
      }

      if (!chosen.includes(hits[0].name)) chosen.push(hits[0].name);
    }
    return { chosen, skipped };
  }

  async function stepSelectBanks() {
    const stored = await requestBanks();
    throwIfStopped();
    const sources = stored.length > 0 ? stored : capturedBanks;
    if (sources.length === 0) fail('Banka listesi belleğe alınamadı');

    try {
      step('Bankalar eşleştiriliyor');

      const { chosen: banks, skipped } = resolveBanks(sources, await readBankTargets());

      // Atlananlar bölüm yarıda kalsa da yazılabilsin diye akışın belleğinde
      // tutulur (bkz. bankaWarnings).
      skippedBanks = skipped;

      // Hiçbir ad bağlanamadıysa işaretlenecek banka kalmaz; boş bir talep
      // hazırlamak yerine bölüm burada durur.
      if (banks.length === 0) fail('Sorgudaki hiçbir kurum Banka Seç listesinde bulunamadı');

      stepIndex += 1;

      let done = 0;
      for (const target of banks) {
        done += 1;
        send({
          t: 'STEP',
          label: `Bankalar seçiliyor (${done}/${banks.length})`,
          index: stepIndex,
          total: stepTotal
        });

        const result = await selectOneBank(target);
        if (!result.ok) fail(`Banka seçilemedi (${done}/${banks.length})`);

        await sleep(120);
      }

      return banks.length;
    } finally {
      // Başarısızlıkta da açık kalan liste ekranı kapatılır.
      await closeBankGrid();
    }
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

      if (radioChecked(radio)) return;

      radio.click();

      if (await waitFor(() => {
        const current = findRadio(label);
        return !!current && radioChecked(current);
      }, 2500)) return;
    }

    fail(errorLabel);
  }

  // Banka talebinin evrak türü; popup'taki "Banka talep türü" seçeneğinden
  // gelir, öntanımlısı 89/1'dir. radio, Talep Gönder ekranındaki seçeneğin
  // etiketidir (ölçüm 2026-09-21: Haciz Müzekkeresi, 89/1, 89/2, 89/3 Haciz
  // İhbarnamesi). Müzekkere seçilince formda başka hiçbir alan değişmiyor;
  // akışın geri kalanı iki türde de aynıdır.
  const BANKA_EVRAK = {
    ihbarname: {
      radio: '89/1 Haciz İhbarnamesi',
      step: '89/1 haciz ihbarnamesi seçiliyor',
      error: '89/1 işaretlenemedi',
      note: '89/1 haciz talebi'
    },
    muzekkere: {
      radio: 'Haciz Müzekkeresi',
      step: 'Haciz müzekkeresi seçiliyor',
      error: 'Haciz müzekkeresi işaretlenemedi',
      note: 'haciz müzekkeresi talebi'
    }
  };

  async function stepSelectBankaEvrak(evrak) {
    step(evrak.step);
    await selectRadio(evrak.radio, evrak.error);
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
    //
    // Talep bu tıklamayla eklenir. Sonucu durdurma isteği gelse de beklenir
    // ki eklenen bankalar özette sayılsın (bkz. waitForSettled).
    const outcome = await waitForSettled(() => {
      if (alertVisible()) return 'alert';
      if (findEvrakOlusturButton()) return 'hazir';
      return null;
    }, 25000);

    if (outcome === 'alert') {
      if (dismissInfoAlert() !== 'dismissed') fail('Onay kutusu kapatılamadı');
      await waitForSettled(() => !alertVisible(), 4000);
    }

    if (!await waitForSettled(findEvrakOlusturButton, 20000)) fail('Talep eklenemedi');
  }

  async function stepCreateDocument() {
    step('Talep evrakı oluşturuluyor');

    const button = findEvrakOlusturButton();
    if (!button) fail('Talep evrakı düğmesi bulunamadı');

    await waitForLoaderGone();
    button.click();
    documentRequested = true;

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
  //
  // Taramadan yalnız cümle sayısı ve cümlelerin hangi sorgulara ait olduğu
  // saklanır. Eşleşmelerin kendisi saklanmaz: her eşleşme aranan metnin
  // tamamını, yani sayfanın bütün yazısını içinde taşır. Eskiden bu metin bir
  // sonraki taramaya kadar, çalıştırma bittikten sonra da bellekte kalıyordu.
  let lastScan = { at: 0, count: 0, owners: [] };

  function noRecordSentences(force = false) {
    const now = Date.now();
    if (!force && now - lastScan.at < 500) return lastScan;

    const matches = [...normalize(resultText()).matchAll(EMPTY_RESULT)];

    lastScan = {
      at: now,
      count: matches.length,
      owners: Object.keys(EMPTY_OWNERS)
        .filter(key => matches.some(match => EMPTY_OWNERS[key].test(match[1] || '')))
    };
    return lastScan;
  }

  // baseline verilirse, sorgudan ÖNCE ekranda kaç cümle olduğunu söyler:
  // sayı arttıysa yeni cümle bu sorguya aittir. Kayıt adı tanınıyorsa cümle
  // zaten doğrudan sahibine bağlanır. İkisi de tutmuyorsa cümle başkasınındır
  // ve bu sorgu için "kayıt yok" sayılmaz.
  function queryReportedNoRecord(flowKey, baseline = -1) {
    const scan = noRecordSentences();

    if (baseline >= 0 && scan.count > baseline) return true;

    return scan.owners.includes(flowKey);
  }

  // Ücretsiz sorgu hakkı bittiğinde UYAP "... ücret alınacaktır" diye İptal /
  // Tamam düğmeli bir kutu açar. Cümlesi tutarın kendisini içerdiği için
  // olduğu gibi kullanıcıya gösterilir; düğme etiketleri dışarıda kalsın diye
  // metin gövdeden okunur.
  //
  // Kutu, sorgunun cevabı beklenirken her yoklamada (saniyede sekiz kez)
  // aranır. Dosya penceresi de bir katman olduğundan eskiden her turda onun
  // bütün metni baştan okunuyordu. Artık bir katmanın metnine ancak iki
  // düğmesi de varsa bakılır.
  function findFeeDialog() {
    for (const popup of document.querySelectorAll('.dx-overlay-content')) {
      if (!isVisible(popup)) continue;

      const confirm = [...popup.querySelectorAll('.dx-button[aria-label="Tamam"]')]
        .find(isVisible);
      const cancel = [...popup.querySelectorAll('.dx-button[aria-label="İptal"]')]
        .find(isVisible);

      if (!confirm || !cancel) continue;
      if (!/ücret alınacaktır/i.test(textOf(popup))) continue;

      const message = textOf(popup.querySelector('.dx-popup-content')) || textOf(popup);

      return { confirm, cancel, message };
    }
    return null;
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

  // Pencerede iki seçenek var: "Haciz" ve "Rehinin Paraya Çevrilmesi". Haciz
  // talebinde daima ilki işaretlenir.
  const SERH_OPTION = 'Haciz';

  const findSerhRadio = () => {
    const popup = findSerhPopup();
    return popup ? radioIn(popup, SERH_OPTION) : null;
  };

  // Kayıt sayısı ve sayfa geçişi banka bölümündeki ortak yardımcılarla
  // yapılır (gridRecordCount, goToNextPage).

  // Satırdaki düğmeye basıldıktan sonrasını yürütür: varsa haciz şerhi
  // penceresi, ardından "Talep eklendi." kutusu.
  //
  // İcra dosyası ve TAKBİS'te kayıt satırdaki tıklamayla eklenir, EGM'de şerh
  // penceresindeki düğmeyle. Eklemeyi izleyen beklemeler durdurma isteğiyle
  // kesilmez (bkz. waitForSettled). Şerh penceresi açıkken gelen istekte ise
  // henüz bir şey eklenmemiştir: Akış orada durur, pencereyi temizlik kapatır.
  async function completeAdd() {
    const outcome = await waitForSettled(() => {
      if (findSerhPopup()) return 'serh';
      if (alertVisible()) return 'alert';
      return null;
    }, 25000);

    if (!outcome) fail('Talep eklenemedi');

    if (outcome === 'serh') {
      throwIfStopped();

      // Seçenekler pencereyle birlikte çiziliyor (ölçüm 2026-11-09). Geç
      // çizildikleri bir gün için kısa bir süre beklenir.
      const radio = await waitFor(findSerhRadio, 5000);
      if (!radio) fail('Haciz şerhi seçeneği bulunamadı');

      if (!radioChecked(radio)) radio.click();

      const checked = await waitFor(() => {
        const el = findSerhRadio();
        return !!el && radioChecked(el);
      }, 3000);
      if (!checked) fail('Haciz şerhi işaretlenemedi');

      const add = [...findSerhPopup()
        .querySelectorAll('[role="button"][aria-label="Haciz Talebine Ekle"]')]
        .filter(isVisible)[0];
      if (!add) fail('Şerh penceresindeki düğme bulunamadı');

      // Durdurma isteğine ve yükleme perdesine son kez bakılır: Bu tıklamadan
      // sonra kayıt eklenir.
      await waitForLoaderGone();
      add.click();

      if (!await waitForSettled(alertVisible, 25000)) fail('Talep eklenemedi');
    }

    // "Talep eklendi." kutusu bir süre sonra kendiliğinden de kapanır; erken
    // kapanmışsa kapatacak bir şey kalmaz ve bu bir hata değildir. İki düğmeli
    // gerçek bir soru çıkarsa dokunulmaz ve durulur.
    if (dismissInfoAlert() === 'blocked') fail('Beklenmeyen onay kutusu');
    await waitForSettled(() => !alertVisible(), 5000);
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
    const baseline = noRecordSentences(true).count;

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
        sectionAdded += 1;
        await sleep(200);
      }

      if (!await goToNextPage(findHacizGrid)) break;
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
  // eklendi, neden eklenmedi, nerede takıldı. Bölümün kendisi yürüdüğü hâlde
  // kullanıcının gözden geçirmesi gereken bir şey kaldıysa (adı eşleşmediği
  // için atlanan kurum) bu nota karışmaz, ayrı bir uyarı satırı olarak
  // altına yazılır.
  const stage = (key, name, state, note = '', warns = []) =>
    send({ t: 'STAGE', key, name, state, note, warns });

  // Banka bölümünün uyarı satırları: YALNIZ o çalıştırmada gerçekten olan bir
  // şey yazılır, atlanan kurumlar. Sonucun talep ile teyit edilmesi gerektiği
  // her çalıştırmada aynı olduğu için bölüm satırına değil, popup'taki "Nasıl
  // kullanılır?" bölümüne yazılıdır (bkz. popup.html).
  function bankaWarnings() {
    const warns = [];

    const missing = skippedBanks.filter(item => item.reason === 'yok');
    const ambiguous = skippedBanks.filter(item => item.reason === 'belirsiz');

    if (missing.length > 0) {
      warns.push(
        'Banka Seç listesinde bulunamadığı için atlandı: ' +
        missing.map(item => item.name).join(', ')
      );
    }
    if (ambiguous.length > 0) {
      warns.push(
        'Birden çok bankaya uyduğu için atlandı: ' +
        ambiguous.map(item => item.name).join(', ')
      );
    }
    return warns;
  }

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
  //
  // Kullanıcı akışı durdurduğunda (confirmUnknown false) İptal'i olmayan iki
  // düğmeli kutuya hiç dokunulmaz: ne sorduğu bilinmiyor, karar kullanıcının.
  async function clearOverlays({ confirmUnknown = true } = {}) {
    for (let attempt = 0; attempt < 5; attempt++) {
      // Yerini yeni kopyaya bırakan kopya, yeni çalıştırmanın kutularına dokunmaz.
      if (!isCurrent()) return false;

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
        const single = [...popup.querySelectorAll('.swal2-actions button')]
          .filter(isVisible).length === 1;

        let button = null;
        if (isVisible(cancel)) button = cancel;
        else if (confirmUnknown || single) button = popup.querySelector('.swal2-confirm');
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

      await closeOpenLists();
      return true;
    }
    return false;
  }

  // Açık kalan Hesap Seç listesi ve Talep Tipi / Talep Türü seçenek listesi.
  // Önünü kesmezler ama yeniden başlatılan akış aynı alanın düğmesine
  // bastığında liste açılmak yerine kapanır ve beklenen liste hiç gelmez.
  // Kapatılamazlarsa akış bu yüzden durmaz.
  async function closeOpenLists() {
    if (findAccountGrid()) {
      findEditorByPlaceholder('Hesap Seçiniz')?.button.click();
      await waitFor(() => !findAccountGrid(), 3000);
    }

    const listOpen = [...document.querySelectorAll('[role="option"]')].some(isVisible);
    const editor = listOpen
      ? [...document.querySelectorAll('.dx-dropdowneditor.dx-dropdowneditor-active')]
        .find(isVisible)
      : null;
    const button = editor?.querySelector('.dx-dropdowneditor-button');
    if (button) {
      button.click();
      await waitFor(() => !editor.classList.contains('dx-dropdowneditor-active'), 3000);
    }
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
    throwIfStopped();

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
      if (stoppedBy(error)) throw asStop(error);

      await clearOverlays();
      return { ok: false, note: `Talep evrakı oluşturulamadı: ${stopNote(error)}` };
    }
  }

  // Durdurma isteğinden sonra çıkan hata da (eklemenin sonucu gelmedi, beklenmeyen
  // kutu) durdurma sayılır: Bölüm "takıldı" diye yazılmaz, kutulara "devam"
  // anlamında dokunulmaz, sıradaki bölüme geçilmez.
  const stoppedBy = error => error instanceof StopRequest || stopRequested;
  const asStop = error => (error instanceof StopRequest ? error : new StopRequest());

  async function runBulkFlow(allowPaid, types, bankaEvrak) {
    // Türler popup'tan gelir. Eski bir popup'tan tür listesi hiç gelmezse
    // akış eskisi gibi dördünü de çalıştırır.
    const chosen = Array.isArray(types) && types.length > 0 ? types : BULK_TYPES;

    // Sıra burada belirlenir, kullanıcının tikleme sırası değil: banka bölümü
    // talep formunu açtığı için daima en sonda çalışmalıdır.
    const queries = BULK_QUERIES.filter(key => chosen.includes(key));
    const withBanka = chosen.includes('banka');

    // Her sorgu bölümü 4 adım (kart, sorgu, hazırlık, kayıt sayacı), banka
    // bölümü 11 adım. Evrak bölümü normalde 2 adımdır; banka bölümü Talep
    // Gönder ekranında bittiği için o sekmeyi açma adımı orada düşer.
    stepTotal = queries.length * 4 + (withBanka ? 12 : 2);

    let failed = 0;

    // Haciz talebine kaç kayıt girdiği: evrak adımının çalışıp çalışmayacağına
    // bu karar verir.
    let prepared = 0;

    // Bitişte gösterilecek özet için bölüm başına kayıt sayısı.
    const counts = [];

    let evrak;

    try {
      for (const key of queries) {
        const flow = QUERY_FLOWS[key];
        stage(key, flow.label, 'running', 'Sorgulanıyor');
        paidApproved = false;
        sectionAdded = 0;

        try {
          const result = await runBulkQuery(flow, allowPaid);
          prepared += result.added;
          counts.push(`${flow.label} ${result.added}`);
          stage(key, flow.label, 'done', result.note);
        } catch (error) {
          // Durdurulan bölüm "takıldı" sayılmaz ve sıradaki bölüme geçilmez.
          // Yarıda kalmadan önce eklediği kayıtlar da talepte durur.
          if (stoppedBy(error)) {
            if (sectionAdded > 0) {
              prepared += sectionAdded;
              counts.push(`${flow.label} ${sectionAdded}`);
            }
            stage(key, flow.label, 'stopped', withCost(sectionAdded > 0
              ? `Durduruldu, ${sectionAdded} kayıt talebe eklenmişti`
              : 'Durduruldu'));
            throw asStop(error);
          }

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
        skippedBanks = [];

        try {
          await stepQueryBanks(allowPaid);
          await stepOpenTalepForm();

          const selected = await stepSelectBanks();

          await stepSelectAccountTypes();
          await stepSelectBankaEvrak(bankaEvrak);
          await stepAddTalep();

          prepared += selected;
          counts.push(`Banka ${selected}`);
          stage('banka', 'Banka', 'done', withCost(
            `${selected} banka için ${bankaEvrak.note} eklendi`
          ), bankaWarnings());
        } catch (error) {
          if (stoppedBy(error)) {
            stage('banka', 'Banka', 'stopped', withCost('Durduruldu'), bankaWarnings());
            throw asStop(error);
          }

          failed += 1;
          stage('banka', 'Banka', 'error', stopNote(error), bankaWarnings());
          await clearOverlays();
        }
      }

      evrak = await runBulkDocument(prepared);
    } catch (error) {
      // Durdurma özetinde o ana kadar talebe eklenenler yazılır (bkz. run).
      if (stoppedBy(error)) {
        const stop = asStop(error);
        stop.prepared = prepared;
        stop.counts = counts;
        throw stop;
      }
      throw error;
    }

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

  // Durdurulan akışın ardından: Akışın açtığı pencere ve kutular kapatılır ki
  // baştan başlatınca yolu tıkamasın, sonra popup'a ne kadarının yapıldığı
  // yazılır. Talebe eklenmiş kayıtlar geri alınmaz, sayısı söylenir.
  async function finishStopped(error) {
    // Yeni bir kopya yüklendiği için durdurulduysa (bkz. dosyanın sonu) sayfaya
    // artık o kopya dokunur. Bu kopya hiçbir şeye tıklamadan çekilir.
    if (!isCurrent()) return;

    // Temizlikteki beklemeler çalışabilsin diye istek düşürülür. Bu sırada
    // yeniden durdurulursa temizlik yarıda bırakılır, sonuç yine yazılır.
    stopRequested = false;
    try {
      await clearOverlays({ confirmUnknown: false });
    } catch (_) {
      // Kapatılamayan kutu kullanıcıya kalır.
    }

    const prepared = error.prepared || 0;
    const counts = error.counts || [];

    let detail = prepared > 0
      ? `Durdurulana kadar ${prepared} kayıt talebe eklendi (${counts.join(', ')})`
      : 'Talebe kayıt eklenmedi';
    if (documentRequested) detail += '. Talep evrakı oluşturma düğmesine basılmıştı';

    send({ t: 'STOPPED', detail });
  }

  // Başlatma sürerken gelen durdurma isteğinin çalıştırma kimliği. START bu
  // kimlikle sonradan gelirse akış hiç başlamaz.
  let cancelledRun = '';

  async function run(options) {
    if (running) return;

    const id = typeof options.run === 'string' ? options.run : '';
    if (id && id === cancelledRun) {
      send({ t: 'STOPPED', detail: 'Talebe kayıt eklenmedi', run: id });
      return;
    }

    running = true;
    runId = id;
    stopRequested = false;
    stepIndex = 0;
    capturedBanks = [];
    skippedBanks = [];
    paidApproved = false;
    sectionAdded = 0;
    documentRequested = false;

    try {
      // Tanınmayan ya da hiç gelmeyen değer öntanımlı 89/1 sayılır.
      const bankaEvrak = options.bankaTalep === 'muzekkere'
        ? BANKA_EVRAK.muzekkere
        : BANKA_EVRAK.ihbarname;
      const result = await runBulkFlow(options.paid === true, options.types, bankaEvrak);

      send({ t: 'DONE', label: result.label, detail: result.detail });
    } catch (error) {
      if (error instanceof StopRequest) {
        await finishStopped(error);
      } else {
        const stop = error instanceof StepError ? error : null;
        send({ t: 'FAIL', label: stop?.headline || '', detail: stop?.detail || '' });
      }
    } finally {
      capturedBanks = [];
      skippedBanks = [];
      stopRequested = false;
      running = false;
    }
  }

  // Popup'taki durdurma düğmesi. Akış sürüyorsa kesilir ve özeti kendisi
  // yazar. Sürmüyorsa (az önce bitti ya da sayfa yenilendi) popup yine de
  // beklemede kalmasın diye hemen "durdu" denir.
  function stopRun(message) {
    if (running) {
      requestStop();
      // İstek alındı: Akış, UYAP'ın o an eklemekte olduğu kaydın sonucunu
      // bekleyip öyle durur. Bu birkaç saniye sürebilir, arka plan popup'ı bu
      // sürede "Durduruldu"ya çevirmez.
      send({ t: 'STOPPING' });
      return;
    }

    // Başlatma sürerken gelen istek: Akış hiç başlamayacak.
    const id = typeof message.run === 'string' ? message.run : '';
    const pending = !!id && id !== runId;
    if (pending) cancelledRun = id;
    send({ t: 'STOPPED', detail: pending ? 'Talebe kayıt eklenmedi' : '', run: id || runId });
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

  function onExtensionMessage(event) {
    if (!isCurrent()) return;

    let message;
    try {
      message = JSON.parse(event.detail);
    } catch (_) {
      return;
    }
    if (message.t === 'START') run(message);
    else if (message.t === 'STOP') stopRun(message);
  }

  document.addEventListener(TO_PAGE, onExtensionMessage);

  // --- Yerini yeni kopyaya bırakma ------------------------------------------
  //
  // Service worker her çalıştırmadan önce bu dosyayı yeniden yükler. Nesil
  // damgası eski kopyayı yalnız susturuyordu; sayfadaki dinleyicisi yerinde
  // kaldığı için kopya bütün değişkenleriyle bellekte duruyordu. Bunların
  // arasında izleyicinin tuttuğu dosya penceresi de vardı: pencere
  // kapandıktan sonra da içindeki tablolarla birlikte silinemiyordu. Gün boyu
  // yenilenmeyen bir UYAP sekmesinde her toplu haciz böyle bir kopya daha
  // bırakıyordu. Ölçüm (2026-09-27, sahte dosya penceresiyle, 10 çalıştırma):
  // kapanan 10 pencerenin 52.050 düğümü de bellekte kaldı, yığın 8 MB büyüdü.
  // Artık yeni kopya yüklenince eskisi dinleyicisini ve zamanlayıcısını söker,
  // elindeki pencereyi bırakır; onu tutan bir şey kalmaz.
  try {
    REGISTRY.retire?.();
  } catch (_) {
    // Sökülemeyen eski kopya yine de nesil damgasıyla susar.
  }

  REGISTRY.retire = () => {
    clearInterval(watcher);
    document.removeEventListener(TO_PAGE, onExtensionMessage);
    watchedFileWindow = null;
    pendingChange = null;

    // Yarıda kalan akış da durur: Yeni kopya başlarken iki akış aynı sayfaya
    // tıklamasın. Bu kopya artık konuşmadığı için özet yazmaz (bkz. send).
    if (running) requestStop();
  };
})();
