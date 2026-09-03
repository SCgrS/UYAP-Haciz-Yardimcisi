UYAP Haciz Yardımcısı v2.7.5

NE YAPAR
Popup'ın en üstünde tek düğmelik "Toplu Haciz" bölümü, altında da dört ayrı
bölüm vardır: Banka Haczi, EGM Sorgusu, İcra Dosyası Sorgusu ve TAKBİS
Sorgusu. Ayrı bölümlerin kendi düğmesi ve kendi seçenekleri vardır. Aynı anda
yalnız bir işlem çalışır ve ilerlemesi üstteki ortak durum çubuğunda görünür.

TOPLU HACZİ HAZIRLA
Tek düğmeyle EGM, icra dosyası, TAKBİS ve banka hacizleri bu sırayla
hazırlanır. Aşağıdaki bölümlerin tikleri ve ödeme seçeneği bu düğmeyi
ETKİLEMEZ; davranış sabittir:

  1. EGM-TNB kartı açılır, sorgulanır, çıkan araçların hepsi haciz talebine
     eklenir. Talep evrakı oluşturulmaz, evrak türü seçilmez.
  2. Aynısı İcra Dosyası kartı için yapılır.
  3. Aynısı TAKBİS kartı için yapılır.
  4. Banka bölümü çalışır: sorgu, Talep Gönder, talep tipi/türü, bankaların
     işaretlenmesi, hesap türleri, 89/1 ve Talep Ekle.
  5. Ayrı bir son adım olarak "Talep Evrakı Oluştur" düğmesine basılır ve evrak
     indirilir. Bu tek evrak, önceki bölümlerde eklenen taleplerin hepsini
     kapsar.

Evrak adımı banka bölümünün İÇİNDE değil, ondan SONRA gelir. Kurum borçlularda
banka sorgusu UYAP tarafından hiç yapılamıyor ("Kurumlar için bu sorgu
yapılamamaktadır"); evrak banka adımına bağlı kalsaydı EGM ve TAKBİS'ten
eklenen talepler evraksız kalırdı. Talebe hiç kayıt girmediyse evrak
oluşturulmaz ve satırında bunu yazar.

Toplu akışta ödeme türü (Vakıfbank / e-barobirlik) SEÇİLMEZ, "Kendi Hesaplarım
ile Ödeme" düğmesine BASILMAZ ve evrak türü GİRİLMEZ; "Talep Evrakı Oluştur"
düğmesine basılmasıyla iş biter.

Toplu bölümün tek seçeneği düğmenin altındaki "Ücretli sorguyu onayla" tikidir
ve VARSAYILAN OLARAK KAPALIDIR. Kapalıyken ücret kutusuna dokunulmaz, o bölüm
"Bu sorgu ücretli" notuyla geçilir. Açıkken dört bölümün de (banka dâhil) ücret
kutusu onaylanır ve o bölümün satırına "(ücretli sorgu onaylandı)" yazılır.

CANLI BÖLÜM LİSTESİ
Toplu akış çalışırken durum çubuğunun altında dört satırlık bir liste durur ve
her satır ne olduğunu bir cümleyle söyler:

  EGM            3 kayıt haciz talebine eklendi
  İcra dosyası   Bu sorgu 60 dakikada bir yapılabiliyor: Bu işlem 60 dakikada
                 1 defa yapılabilmektedir.
  TAKBİS         11 kayıt haciz talebine eklendi (ücretli sorgu onaylandı)
  Banka          Bu sorgu kurum borçlularda yapılamıyor: Kurumlar için bu
                 sorgu yapılamamaktadır.
  Talep evrakı   14 kayıt için talep evrakı oluşturuldu

Liste, çalışma bittikten sonra da ekranda kalır ki sonucu okuyabilesiniz.
Dosya penceresini kapattığınızda ya da başka bir dosya açtığınızda
kendiliğinden temizlenir: önceki dosyanın özeti yeni dosyanınmış gibi
görünmesin. Bunun için dosyanın içinden hiçbir şey okunmaz; yalnız dosya
penceresinin kapanıp kapanmadığına, yani ondan ayrılıp ayrılmadığınıza
bakılır.

Yeşil satır bitti, turuncu satır takıldı, mavi satır çalışıyor demektir.
Turuncu satırın altında nedeni yazar: engelin adı ve varsa UYAP'ın kendi
cümlesi.

Bir bölüm takılırsa akış DURMAZ. Ekranda kalan kutu kapatılır (ücret onayında
İptal, şerh penceresinde kapat, bilgi kutusunda Tamam) ve sıradaki bölüme
geçilir. Kapatılamayan bir kutu çıkarsa devam etmenin anlamı kalmadığından
akış orada durur. Bölümlerden biri bile eksik kaldıysa sonuç yeşile dönmez;
"n bölüm tamamlanamadı" yazar.

"KAYIT YOK" CÜMLESİ KİMİN
Bir sorgu kayıtsız çıktığında ekrana "Kuruma ait alacaklı olduğu İcra Dosyası
kaydı yok." gibi bir cümle düşer ve sorgu değişince hemen kalkmaz. Toplu akışta
bu, sırası gelen sorgunun HİÇ YAPILMADAN atlanmasına yol açıyordu. Artık
cümlenin kime ait olduğuna bakılır: kayıt adı (araç / taşınmaz / dosya) hangi
sorgunun konuştuğunu söyler, ayrıca sorgudan önceki cümle sayısı not edilir;
sonradan düşen cümle o sorguya aittir.

Cümle her zaman dosya penceresinin içinde çizilmiyor; sonuç ayrı bir belge
çerçevesine düşebiliyor. Yalnız dosya penceresine bakıldığında cümle
bulunamıyor ve akış olmayacak bir tabloyu iki dakika bekliyordu. Artık sayfanın
tamamı ve aynı kaynaktan gelen çerçeveler taranır; metinde YALNIZ bu cümle
kalıbı aranır.

BANKA HACZİ
Kullanıcı bir icra dosyasında "Borçlu Bilgileri" sekmesinden borçlu seçtikten
sonra, "Banka Haczi Hazırla" düğmesiyle şu adımlar sırayla otomatik yapılır:

  1. Banka sorgu bölümü açılır.
  2. "Sorgula" düğmesine basılır. (Sonuç zaten ekrandaysa 60 dakikalık
     limite takılmamak için yeniden sorgulanmaz.)
  3. Borçluya ait banka listesi geçici olarak belleğe alınır.
  4. "Talep Gönder" sekmesi açılır.
  5. Talep tipi: Haciz Talepleri.
  6. Talep türü: Banka Haczi Talebi.
  7. Belleğe alınan bankalar "Banka Seç" listesinde işaretlenir.
  8. "Hesap Seç" listesinde "Hesap Türü" başlığındaki tik ile tüm hesap
     türleri seçilir.
  9. 89/1 Haciz İhbarnamesi seçilir.
 10. "Talep Ekle" düğmesine basılır ve açılan "Talep eklendi."
     kutusu "Tamam" ile kapatılır.
 11. "Talep Evrakı Oluştur" ile evrak indirilir.

Popup'taki "Ödeme türü ve evrak türü gir" seçeneği KAPALIYSA işlem burada
biter. AÇIKSA seçime göre şöyle devam eder:

  Vakıfbank, onay TİKLİ          : Vakıfbank -> Kendi Hesaplarım ile Ödeme
                                   -> Evrak Türü: Haciz Talebi
  Vakıfbank, onay TİKSİZ         : Vakıfbank -> Evrak Türü: Haciz Talebi
                                   (ödeme düğmesine BASILMAZ, SMS gitmez)
  e-barobirlik                   : e-barobirlik kart
                                   -> Evrak Türü: Haciz Talebi

"Kendi Hesaplarım ile Öde butonuna tıkla" onayı yalnız Vakıfbank seçiliyken
görünür ve varsayılan olarak işaretlidir.

EGM / İCRA DOSYASI / TAKBİS SORGULARI
Üç bölüm de aynı adımları izler:

  1. İlgili sorgu kartı açılır (EGM-TNB, İcra Dosyası, TAKBİS).
  2. "Sorgula" düğmesine basılır. (Sonuç zaten ekrandaysa yeniden
     sorgulanmaz; sorgu hakkı sayılıdır.) Sonuç belgesinde "... kaydı yok"
     yazıyorsa eklenecek bir şey yoktur: akış hemen orada biter ve durum
     çubuğunda "Araç / Taşınmaz / İcra dosyası kaydı yok" yazar. Bu bir hata
     değildir.
  3. Sonuç tablosunun sayfa boyutu en büyüğe (100) çekilir.
  4. Tablodaki HER satırın "Haciz Talebine Ekle" düğmesine sırayla basılır;
     birden çok sayfa varsa sayfalar da gezilir. EGM'de her araç için açılan
     "Haciz Şerhi" penceresinde "Haciz" işaretlenir ve pencerenin kendi
     "Haciz Talebine Ekle" düğmesine basılır. Üç akışta da "Talep eklendi."
     kutusu "Tamam" ile kapatılır.
  5. "Talep Gönder" sekmesi açılır. Bu haciz türlerinde yukarıdaki talep tipi
     ve talep türü alanları DOLDURULMAZ, olduğu gibi bırakılır.
  6. Bölümdeki "Talep evrakını otomatik oluştur" tikliyse "Talep Evrakı
     Oluştur" düğmesine basılır ve evrak türü "Haciz Talebi" seçilir.

Tik KALDIRILIRSA akış Talep Gönder ekranında biter; evrak oluşturulmaz ve
evrak türü seçilmez.

AYRI BÖLÜMLER BİRBİRİNDEN BAĞIMSIZDIR
Alttaki dört düğmenin her biri kendi işini baştan sona tek başına yapar; bir
bölüm diğerinin bıraktığı duruma güvenmez. Sıra ve birikme yalnız "Toplu
Haczi Hazırla" düğmesinde vardır. Bir işlem çalışırken sayfada ikincisi
başlamasın diye o sırada bütün düğmeler pasiftir.

ÜCRETLİ SORGU
Ücretsiz sorgu hakkı bittiğinde UYAP "... ücret alınacaktır" diye İptal/Tamam
düğmeli bir kutu açar. Eklenti bu kutuya kendiliğinden DOKUNMAZ: işlem durur ve
durum çubuğunda "Ücretli sorgu onayı gerekiyor" yazar. Onaylamasını istiyorsanız
o bölümdeki "Ücretli sorguyu onayla" tikini işaretleyin; bu tik varsayılan
olarak kapalıdır ve bölüm bölüm ayrı saklanır. Toplu bölümün kendi tiki
vardır: alttaki bölümlerin tikleri toplu akışı etkilemez.

SORGU NEDEN YAPILAMADI
UYAP bir sorguyu engellediğinde bunu neredeyse her zaman bir kutuyla bildirir.
Eklenti bu kutunun gövde metnini okur, kutuyu kapatır ve nedeni popup'ta
gösterir: üstte kısa başlık, altında UYAP'ın kendi cümlesi. En sık görülenler:

  "Bu işlem 60 dakikada 1 defa yapılabilmektedir."
      -> Bu sorgu 60 dakikada bir yapılabiliyor
  "Bu işlem için yeterli bakiyeniz bulunmamaktadır..."
      -> Sorgu bakiyeniz yetersiz
  "... sorgu limitiniz dolmuştur."
      -> Sorgu limitiniz dolmuş
  "... yetkiniz bulunmamaktadır."
      -> Bu sorgu için yetkiniz yok
  "Kurumlar için bu sorgu yapılamamaktadır."
      -> Bu sorgu kurum borçlularda yapılamıyor
  "... ₺5,00 ücret alınacaktır. Bu işlemi onaylıyor musunuz?"
      -> Bu sorgu ücretli, onay tiki kapalı   (banka bölümünde: Bu sorgu ücretli)

Liste kapalı değildir: tanınmayan bir kutu çıkarsa başlık "Sorgu yapılamadı"
olur ve altında UYAP'ın cümlesi olduğu gibi gösterilir. Engel anlaşıldığı anda
işlem durur; gelmeyecek bir tabloyu beklemez.

Bunun dışında bir adım beklenen sonucu vermezse popup'ta "Bir şeyler ters
gitti" yazar, altında nerede durulduğunu söyleyen kısa bir ipucu görünür.
Hata ayıklama çıktısı üretilmez.

NE YAPMAZ
- "Evrak Gönder" düğmesine basmaz; talebi icra dairesine göndermez.
- İki düğmeli hiçbir onay kutusuna kendiliğinden dokunmaz. Ücret kutusuna
  yalnız ilgili bölümün "Ücretli sorguyu onayla" tiki açıkken basar. Ayrı
  banka bölümünde böyle bir tik yoktur: orada ücret kutusu çıkarsa eklenti
  dokunmadan durur.
- Bir bölüm yarıda kaldığında ekranda kalan kutuyu yalnız "vazgeç" anlamına
  gelen düğmeyle kapatır (ücret kutusunda İptal); hiçbir zaman onaylayarak
  kapatmaz.
- Hukuki değerlendirme yapmaz.
- Emin olunamayan hiçbir bankayı işaretlemez; eşleşmeyen banka olursa işlem
  yarım bırakılmaz, durdurulur.
- Ücretli sorgu onay kutusuna, o bölümde açıkça izin verilmedikçe basmaz.
- Sorgu sonucunun bir bölümünü ekleyip kalanını atlamaz: sayfalayıcının
  bildirdiği kayıt sayısına ulaşılamazsa işlem hata ile durur.

KULLANIM
Kesinleşmiş bir takip dosyasını açın, borçlu bilgileri sekmesini açın, bir
borçlu seçin, daha sonra eklenti simgesine tıklayıp en üstteki "Toplu Haczi
Hazırla" düğmesine ya da tek bir haciz türü için ilgili bölümün düğmesine
basın.

SONUÇLARI DAİMA KONTROL EDİN
Eklenti talebi hazırlar; göndermez. Gönderilecek talebin doğruluğundan
kullanıcı sorumludur.

MAHREMİYET
- Yalnız şunlar okunur: düğme/sekme/seçenek etiketleri, "No/Kurum"
  tablosundaki banka kurum adları, Banka Seç ve Hesap Seç listelerindeki
  satır adları, sayfalayıcıdaki kayıt sayısı ve sayfa numaraları.
- EGM, İcra Dosyası ve TAKBİS sonuç tablolarından plaka, ada/parsel, dosya
  numarası gibi HİÇBİR alan okunmaz; o tablolarda yalnız satırların ekleme
  düğmelerine basılır.
- Dosya numarası, icra dairesi, alacaklı/borçlu ve diğer taraf bilgileri,
  TCKN/VKN, hesap numarası ve bakiye OKUNMAZ.
- Sorgunun kayıtsız çıkıp çıkmadığını anlamak için sayfa metninde YALNIZ
  "... kaydı yok / bulunamadı" cümle kalıbı aranır. Eşleşen cümle dışında
  hiçbir alan okunmaz, hiçbir yere yazılmaz, hiçbir yere gönderilmez.
- UYAP'ın uyarı kutularının gövde metni OKUNUR ve popup'ta gösterilir. Bunlar
  sistem mesajlarıdır (limit, ücret, bakiye, yetki); taraf adı, dosya numarası
  ya da tutar dışında kişisel bilgi taşımazlar. Kutu başlığı ve düğme
  etiketleri okunmaz.
- "Kendi Hesaplarım ile Ödeme" sonrası açılan SMS/doğrulama alanları
  OKUNMAZ.
- Çerez, oturum bilgisi veya token okunmaz.
- Banka adları hiçbir loga yazılmaz.
- Hiçbir ağ isteği yapılmaz. Analytics ve telemetri yoktur.
- Hiçbir veri geliştiriciye veya üçüncü taraflara gönderilmez.

BANKA VERİSİ NEREDE TUTULUR
Banka adları yalnız chrome.storage.session içinde, yani Chrome'un geçici
(RAM) alanında tutulur. Disk'e yazılmaz. Şu dört durumda silinir:
  - herhangi bir bölümün düğmesine yeniden basıldığında,
  - Chrome kapatıldığında,
  - Belleğe alınmasının üzerinden 10 dakika geçtiğinde,
  - Tüm işlemler eksiksiz tamamlandığında.

chrome.storage.local'da yalnız tercihler saklanır: tema (koyu/açık), ödeme
seçeneği ve her sorgu bölümünün iki tiki. Bunlar dosya veya kişi verisi
değildir.

İZİNLER
  storage    : yukarıdaki geçici banka belleği ve tercihler için
  alarms     : 10 dakikalık silme zamanlayıcısı için
  scripting  : eklenti kurulduğunda ZATEN AÇIK olan UYAP sekmesine
               betikleri enjekte etmek için; yoksa sekmeyi elle
               yenilemek gerekir
  host       : yalnız https://avukat.uyap.gov.tr/*

Yalnız https://avukat.uyap.gov.tr/* adresinde çalışır. Uzaktan kod yüklemez,
harici script veya CDN kullanmaz, üçüncü taraf bağımlılığı yoktur.

DOSYALAR
  manifest.json  Eklenti tanımı
  popup.html/css/js  Simgeye tıklayınca açılan pencere
  background.js  Service worker: geçici bellek ve mesaj yönlendirme
  bridge.js      İzole dünya köprüsü (chrome.* <-> sayfa)
  content.js     Sayfa otomasyonu, banka eşleştirme çekirdeği ve sorgu
                 haciz akışları
  tools/make-icons.js  Simge üreticisi (node tools/make-icons.js)

BAĞIMSIZLIK BİLDİRİMİ
Bu uzantı UYAP veya Adalet Bakanlığı tarafından geliştirilmiş ya da
onaylanmış resmî bir ürün değildir. Bağımsız bir yardımcı araçtır.
