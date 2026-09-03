UYAP Haciz Yardımcısı v2.9.0

NE YAPAR
Tek düğmesi vardır: "Toplu Haczi Hazırla". Seçili borçlu için tikli bıraktığınız
haciz türlerini sırayla sorgular, çıkan kayıtların hepsini haciz talebine ekler
ve en sonda tek talep evrakı oluşturur. Talebi GÖNDERMEZ.

Düğmenin üstünde dört tik vardır: EGM, İcra dosyası, TAKBİS ve Banka. Dördü de
varsayılan olarak açıktır; tiki kaldırılan tür hiç sorgulanmaz, bölüm listesine
satırı da düşmez. Altında bir tik daha vardır: "Ücretli sorguyu onayla".

Bilgilendirme metninin tamamı, bölüm başlığının ("TOPLU HACİZ") yanındaki bilgi
işaretinin altındadır; işaretin üzerine gelince açılır.

KULLANIM
Kesinleşmiş bir takip dosyasını açın, Taraf Bilgileri sekmesinden bir borçlu
seçin, sonra eklenti simgesine tıklayıp düğmeye basın.

İşlem sürerken sayfada bir yere TIKLAMAYIN: sıralamayı ve işlemleri sekteye
uğratabilirsiniz. Bu uyarı, çalışma boyunca durum çubuğunun altında da durur.

SIRA
Sıra, tikleme sırasına göre değil, daima şöyledir:

  1. EGM-TNB kartı açılır, sorgulanır, çıkan araçların hepsi haciz talebine
     eklenir. Her araç için açılan "Haciz Şerhi" penceresinde "Haciz"
     işaretlenir.
  2. Aynısı İcra Dosyası kartı için yapılır.
  3. Aynısı TAKBİS kartı için yapılır.
  4. Banka bölümü çalışır: sorgu, Talep Gönder, talep tipi/türü, bankaların
     işaretlenmesi, hesap türleri, 89/1 ve Talep Ekle. Banka seçiliyse HER
     ZAMAN en sonda çalışır: Talep Gönder formunu o açar ve önceki bölümlerin
     eklediği talepler de aynı evrakta toplanır.
  5. Ayrı bir son adım olarak "Talep Evrakı Oluştur" düğmesine basılır ve evrak
     indirilir. Hangi türler seçilirse seçilsin akış bu adımla biter.

Evrak adımı banka bölümünün İÇİNDE değil, ondan SONRA gelir. Kurum borçlularda
banka sorgusu UYAP tarafından hiç yapılamıyor ("Kurumlar için bu sorgu
yapılamamaktadır"); evrak banka adımına bağlı kalsaydı EGM ve TAKBİS'ten
eklenen talepler evraksız kalırdı. Talebe hiç kayıt girmediyse evrak
oluşturulmaz ve satırında bunu yazar.

Ödeme türü (Vakıfbank / e-barobirlik) SEÇİLMEZ, "Kendi Hesaplarım ile Ödeme"
düğmesine BASILMAZ, ödeme ekranı hiç açılmaz ve evrak türü GİRİLMEZ; "Talep
Evrakı Oluştur" düğmesine basılmasıyla iş biter.

SORGULAR SEKMESİ
Sorgu kartları dosya penceresindeki "Sorgular" sekmesinin altındadır. Her
bölümün başında bu sekmenin açık olduğuna bakılır; açık değilse sekmeye
basılır. Böylece bir önceki bölümün bıraktığı Talep Gönder ekranında ya da
elle geçilmiş başka bir sekmede kalınmış olsa bile sorgu kartı bulunur.
Sekme zaten seçiliyse tıklanmaz: seçili sekmeye yeniden basmak o an açık olan
sorgu şeridini kapatabilir.

CANLI BÖLÜM LİSTESİ VE SONUÇ
Çalışırken durum çubuğu o an ne yapıldığını yazar. Altında, seçili her tür için
bir satırlık liste durur ve her satır ne olduğunu bir cümleyle söyler:

  EGM            3 kayıt haciz talebine eklendi
  İcra dosyası   Bu sorgu 60 dakikada bir yapılabiliyor: Bu işlem 60 dakikada
                 1 defa yapılabilmektedir.
  TAKBİS         11 kayıt haciz talebine eklendi (ücretli sorgu onaylandı)
  Banka          Bu sorgu kurum borçlularda yapılamıyor: Kurumlar için bu
                 sorgu yapılamamaktadır.
  Talep evrakı   14 kayıt için talep evrakı oluşturuldu

İş bittiğinde durum kutucuğu yeşile döner, üstünde "SONUÇ" etiketi belirir ve
içinde özet durur:

  SONUÇ
  Tamamlandı
  Toplam 14 kayıt haciz talebine eklendi, talep evrakı oluşturuldu.
  (EGM 3, İcra dosyası 0, TAKBİS 11, Banka 0)

Liste, çalışma bittikten sonra da ekranda kalır ki sonucu okuyabilesiniz.
Dosya penceresini kapattığınızda ya da başka bir dosya açtığınızda
kendiliğinden temizlenir: önceki dosyanın özeti yeni dosyanınmış gibi
görünmesin. Bunun için dosyanın içinden hiçbir şey okunmaz; yalnız dosya
penceresinin kapanıp kapanmadığına, yani ondan ayrılıp ayrılmadığınıza
bakılır.

Yeşil satır bitti, turuncu satır takıldı, mavi satır çalışıyor demektir.
Turuncu satırın altında nedeni yazar: engelin adı ve varsa UYAP'ın kendi
cümlesi. Bir bölüm takılırsa akış durmaz, sıradaki bölüme geçer; ekranda kalan
kutu yalnız "vazgeç" anlamına gelen düğmeyle kapatılır.

ESKİ SÜRÜM UYARISI
Chrome, eklentinin popup dosyalarını her açılışta diskten okur; service worker
ile sayfaya enjekte edilen betikler ise eklenti chrome://extensions sayfasından
YENİLENENE kadar eski sürümde kalır. Bu karışım sessiz ve pahalı bir hataya yol
açıyordu: yeni popup'ta kaldırılan haciz türü tiki eski arka plana hiç ulaşmıyor,
akış yine dört türü de sorguluyordu.

Artık her çalıştırmadan önce popup, arka planın kendi sürümüyle konuşup
konuşmadığını sorar. Tutmuyorsa hiçbir sorgu yapılmaz; durum çubuğunda
"Eklentiyi yenileyin" yazar ve altında ne yapılacağı anlatılır. Sorgu hakları
sayılı olduğu için yanlış çalışmaktansa hiç çalışmamak yeğlenir.

ÜCRETLİ SORGU
Ücretsiz sorgu hakkı bittiğinde UYAP "... ücret alınacaktır" diye İptal/Tamam
düğmeli bir kutu açar. Eklenti bu kutuya kendiliğinden DOKUNMAZ: o bölüm
"Bu sorgu ücretli, onay tiki kapalı" notuyla geçilir. Onaylamasını istiyorsanız
"Ücretli sorguyu onayla" tikini işaretleyin; tik varsayılan olarak kapalıdır.
Açıkken çalışan bölümlerin (banka dâhil) ücret kutusu onaylanır ve o bölümün
satırına "(ücretli sorgu onaylandı)" yazılır.

Hiçbir tür tikli değilken düğmeye basılırsa hiçbir şey yapılmaz; durum
çubuğunda "En az bir haciz türü seçin" yazar.

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
      -> Bu sorgu ücretli, onay tiki kapalı

Liste kapalı değildir: tanınmayan bir kutu çıkarsa başlık "Sorgu yapılamadı"
olur ve altında UYAP'ın cümlesi olduğu gibi gösterilir. Engel anlaşıldığı anda
o bölüm bırakılır; gelmeyecek bir tabloyu beklemez.

Bunun dışında bir adım beklenen sonucu vermezse popup'ta "Bir şeyler ters
gitti" yazar, altında nerede durulduğunu söyleyen kısa bir ipucu görünür.
Hata ayıklama çıktısı üretilmez.

BORÇLUNUN KAYDI YOKSA
Sonuç tablosu hiç gelmez; onun yerine sonuç belgesine "Kişiye ait taşınmaz
kaydı yok." gibi tek satırlık bir cümle düşer. Bu bir hata değildir: o bölüm
"Araç / Taşınmaz / İcra dosyası kaydı yok" notuyla biter ve sıradaki bölüme
geçilir. Cümle sorgu değişince ekrandan hemen kalkmadığı için kime ait olduğuna
da bakılır; yoksa sıradaki sorgu hiç yapılmadan atlanabiliyordu.

NE YAPMAZ
- "Evrak Gönder" düğmesine basmaz; talebi icra dairesine göndermez.
- İki düğmeli hiçbir onay kutusuna kendiliğinden dokunmaz. Ücret kutusuna
  yalnız "Ücretli sorguyu onayla" tiki açıkken basar.
- Ödeme ekranını hiç açmaz; ödeme türü seçmez, "Kendi Hesaplarım ile Ödeme"
  düğmesine basmaz.
- Bir bölüm yarıda kaldığında ekranda kalan kutuyu yalnız "vazgeç" anlamına
  gelen düğmeyle kapatır (ücret kutusunda İptal); hiçbir zaman onaylayarak
  kapatmaz.
- Hukuki değerlendirme yapmaz.
- Emin olunamayan hiçbir bankayı işaretlemez; eşleşmeyen banka olursa işlem
  yarım bırakılmaz, durdurulur.
- Sorgu sonucunun bir bölümünü ekleyip kalanını atlamaz: sayfalayıcının
  bildirdiği kayıt sayısına ulaşılamazsa o bölüm hata ile durur.

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
- Çerez, oturum bilgisi veya token okunmaz.
- Banka adları hiçbir loga yazılmaz.
- Hiçbir ağ isteği yapılmaz. Analytics ve telemetri yoktur.
- Hiçbir veri geliştiriciye veya üçüncü taraflara gönderilmez.

BANKA VERİSİ NEREDE TUTULUR
Banka adları yalnız chrome.storage.session içinde, yani Chrome'un geçici
(RAM) alanında tutulur. Disk'e yazılmaz. Şu dört durumda silinir:
  - düğmeye yeniden basıldığında,
  - Chrome kapatıldığında,
  - Belleğe alınmasının üzerinden 10 dakika geçtiğinde,
  - Tüm işlemler eksiksiz tamamlandığında.

chrome.storage.local'da yalnız tercihler saklanır: tema (koyu/açık), haciz
türü tikleri ve ücret onayı. Bunlar dosya veya kişi verisi değildir.

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
