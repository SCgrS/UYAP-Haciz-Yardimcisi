# UYAP Haciz Yardımcısı

UYAP Avukat Portalı'nda, seçili borçlu için EGM, icra dosyası, TAKBİS ve banka hacizlerini
tek düğmeyle hazırlayan Chrome eklentisi. Sorguları sırayla yapar, çıkan kayıtların hepsini
haciz talebine ekler ve en sonda tek bir talep evrakı oluşturur. Talebi **göndermez**; son
kontrol ve gönderme sizde kalır.

Eklenti bağımsız bir yardımcı araçtır; UYAP ya da Adalet Bakanlığı tarafından geliştirilmiş
veya onaylanmış resmî bir ürün değildir.

## Ne yapar

- Dosya penceresindeki **Sorgular** sekmesinde EGM-TNB, İcra Dosyası ve TAKBİS kartlarını
  sırayla açıp sorgular; sonuç tablosundaki her satırı **Haciz Talebine Ekle** ile talebe ekler.
- EGM'de her araç için açılan **Haciz Şerhi** penceresinde **Haciz** seçeneğini işaretler.
- Banka sorgusundan çıkan bütün bankaları **Talep Gönder** sekmesinde tek tek seçer, tüm hesap
  türlerini işaretler, **89/1 Haciz İhbarnamesi**'ni seçip **Talep Ekle**'ye basar.
- En sonda **Talep Evrakı Oluştur** düğmesine basar; evrak indirilir, orada durur.
- Hangi bölümün ne yaptığını (kaç kayıt eklendi, neden eklenmedi) canlı bir listede yazar;
  bir bölüm takılırsa durmaz, sıradaki bölüme geçer.
- UYAP bir kutuyla engellediğinde (60 dakika sınırı, bakiye, saat penceresi, kurum borçlusu)
  kutunun cümlesini olduğu gibi gösterir.
- Sorgu zaten yapılmış ve sonucu ekrandaysa sorguyu yinelemez; sorgu hakkı harcamaz.

## Kurulum

Eklenti Chrome Web Mağazası'nda değil; kaynak koddan yüklenir. Chrome 102 ve üzeri (ya da
Edge gibi Chromium tabanlı bir tarayıcı) gerekir, yönetici hakkı gerekmez.

> Depo özel (private) olduğu için aşağıdaki bağlantı yalnızca GitHub'da oturumu açık olan
> yetkili hesaplarda çalışır.

### Kaynak koddan

1. [github.com/SCgrS/UYAP-Haciz-Yardimcisi](https://github.com/SCgrS/UYAP-Haciz-Yardimcisi)
   sayfasında yeşil **Code** düğmesine, açılan menüde **Download ZIP**'e tıklayın.
2. İndirilen ZIP'i açın ve içindeki klasörü kalıcı bir yere koyun (ör. `C:\projeler`).
   Chrome eklentiyi bu klasörden çalıştırır; klasör silinir ya da taşınırsa eklenti durur.
3. Chrome'da adres çubuğuna `chrome://extensions` yazıp Enter'a basın.
4. Sağ üstteki **Geliştirici modu** anahtarını açın.
5. Sol üstte beliren **Paketlenmemiş öğe yükle** düğmesine basın ve `manifest.json`
   dosyasının bulunduğu klasörü seçin.
6. Araç çubuğundaki **Uzantılar** (yapboz) simgesine tıklayıp **UYAP Haciz Yardımcısı**'nın
   yanındaki raptiyeye basın; simge çubukta kalır.

Eklenti diske hiçbir şey yazmaz, kayıt defterine dokunmaz, kısayol eklemez. Tercihleri
Chrome'un kendi eklenti deposunda durur ve eklentiyle birlikte silinir.

### Güncelleme

Eklenti kendini güncellemez. Yeni ZIP'i indirip aynı klasörün içeriğini değiştirin, sonra
`chrome://extensions` sayfasında eklentinin kartındaki **yenile** (dairesel ok) düğmesine
basın. Açık UYAP sekmesini yenilemeniz gerekmez; eklenti her çalıştırmada betiklerini sayfaya
yeniden yükler.

> Popup'ta **Eklentiyi yenileyin** yazıyorsa Chrome arka planda hâlâ eski sürümü çalıştırıyor
> demektir. Aynı yenile düğmesine basın; eklenti o düzeltilene kadar hiçbir sorgu yapmaz.

## Kullanım

1. UYAP Avukat Portalı'nda kesinleşmiş bir takip dosyasını açın.
2. **Taraf Bilgileri** sekmesinden bir borçlu seçin.
3. Araç çubuğundaki eklenti simgesine tıklayın, tikleri kontrol edip
   **Toplu Haczi Hazırla**'ya basın.

> İşlem sürerken sayfada bir yere tıklamayın; sıralamayı ve işlemleri sekteye uğratabilirsiniz.
> Bu uyarı çalışma boyunca durum çubuğunun altında da durur.

| Öğe | Ne yapar |
|---|---|
| **EGM**, **İcra dosyası**, **TAKBİS**, **Banka** | Hangi haciz türlerinin hazırlanacağı. Dördü de varsayılan olarak açıktır; tiki kaldırılan tür hiç sorgulanmaz ve listeye satırı düşmez. |
| **Ücretli sorguyu onayla** | Ücretsiz hak bittiğinde UYAP'ın açtığı "... ücret alınacaktır" kutusunu onaylar. Varsayılan olarak kapalıdır; kapalıyken kutu **İptal** ile kapatılır ve o bölüm geçilir. |
| **Toplu Haczi Hazırla** | Tikli türleri aşağıdaki sırayla hazırlar. Hiçbir tür tikli değilse "En az bir haciz türü seçin" yazar. |
| Bilgi işareti (**Toplu Haciz** başlığının yanı) | Üzerine gelince kısa kullanım notları açılır. |
| Sağ üstteki güneş/ay düğmesi | Koyu / açık mod. |

### Sıra

Sıra tikleme sırasına göre değil, daima şöyledir:

1. **EGM-TNB** kartı açılır, sorgulanır, çıkan araçların hepsi haciz talebine eklenir.
2. Aynısı **İcra Dosyası** kartı için yapılır.
3. Aynısı **TAKBİS** kartı için yapılır.
4. **Banka** bölümü çalışır: sorgu, **Talep Gönder** sekmesi, **Haciz Talepleri** >
   **Banka Haczi Talebi**, bankaların işaretlenmesi, hesap türleri, **89/1 Haciz İhbarnamesi**,
   **Talep Ekle**. Banka seçiliyse her zaman en sonda çalışır; önceki bölümlerin eklediği
   talepler de aynı evrakta toplanır.
5. **Talep Evrakı Oluştur** düğmesine basılır ve evrak indirilir. Hangi türler seçilirse
   seçilsin akış bu adımla biter; talebe hiç kayıt girmediyse evrak oluşturulmaz ve durum
   kutusu bunu yazar.

Ödeme türü seçilmez, **Kendi Hesaplarım ile Ödeme**'ye basılmaz, ödeme ekranı hiç açılmaz,
evrak türü girilmez.

### Sonuç ve bölüm listesi

Çalışırken durum çubuğu o an ne yapıldığını yazar. Altında seçili her tür için bir satır
durur: yeşil bitti, turuncu takıldı, mavi çalışıyor demektir. Turuncu satırın altında nedeni
yazar.

```
EGM            3 kayıt haciz talebine eklendi
İcra dosyası   Uyarı: Bu işlem 60 dakikada 1 defa yapılabilmektedir.
TAKBİS         11 kayıt haciz talebine eklendi (ücretli sorgu onaylandı)
Banka          Uyarı: Kurumlar için bu sorgu yapılamamaktadır.
```

Talep evrakı listede yer almaz; ne olduğu durum kutusunun içinde, başlığın altında yazar.
Her şey sorunsuz bittiyse kutu yeşile döner ve **Tamamlandı** başlığının altında
"14 kayıt için talep evrakı oluşturuldu (EGM 3, İcra dosyası 0, TAKBİS 11, Banka 0)" gibi
bir özet çıkar. Bir bölüm takıldıysa kutu turuncuya döner ve başlık "1 bölüm tamamlanamadı"
olur; hazırlanan talep eksiktir, göndermeden önce bakın.

Liste, çalışma bittikten sonra da ekranda kalır. Dosya penceresini kapattığınızda ya da
başka bir dosya açtığınızda kendiliğinden temizlenir.

### UYAP sorguyu engellediğinde

UYAP bir sorguyu engellediğinde bunu bir kutuyla bildirir. Eklenti kutunun gövde metnini
okur, kutuyu kapatır ve bölüm satırına başında "Uyarı:" ile aynen yazar:

```
Uyarı: Bu işlem 60 dakikada 1 defa yapılabilmektedir.
Uyarı: Bu işlem için yeterli bakiyeniz bulunmamaktadır. ...
Uyarı: Kurumlar için bu sorgu yapılamamaktadır.
Uyarı: Bu sorgu türü, 09:00-10:00 ve 15:00-16:00 saatleri arasında yapılamamaktadır. ...
Uyarı: Bu işlem için ₺5,00 ücret alınacaktır. Bu işlemi onaylıyor musunuz?
       (ücretli sorgu onayı kapalı)
```

60 dakika, saat penceresi, bakiye, limit, yetki ve kurum borçlusu cümlelerini tanır; tanıdığında
beklemeyi hemen keser ve sıradaki bölüme geçer. Tanımadığı bir kutuda cümle yine gösterilir,
arkasından tablo gelir mi diye 8 saniye daha beklenir.

Borçlunun kaydı yoksa bu bir hata değildir: bölüm "Araç kaydı yok", "İcra dosyası kaydı yok"
ya da "Taşınmaz kaydı yok" notuyla biter. Beklenen bir öğe hiç gelmezse durum çubuğunda
"Bir şeyler ters gitti" yazar, altında nerede durulduğu belirtilir.

## Ne yapmaz

- **Evrak Gönder**'e basmaz; talebi icra dairesine göndermez.
- İki düğmeli hiçbir onay kutusuna kendiliğinden dokunmaz. Ücret kutusuna yalnız
  **Ücretli sorguyu onayla** açıkken basar.
- Bir bölüm yarıda kaldığında ekranda kalan kutuyu yalnız "vazgeç" anlamına gelen düğmeyle
  (ücret kutusunda **İptal**, tek düğmeli bilgi kutusunda **Tamam**) kapatır; hiçbir zaman
  onaylayarak kapatmaz.
- Emin olunamayan hiçbir bankayı işaretlemez; eşleşmeyen banka olursa banka bölümü durur.
- Sorgu sonucunun bir kısmını ekleyip kalanını atlamaz: sayfalayıcının bildirdiği kayıt
  sayısına ulaşılamazsa o bölüm hata ile durur.
- Hukuki değerlendirme yapmaz. Gönderilecek talebin doğruluğundan siz sorumlusunuz.

## Verileriniz nerede duruyor?

Eklenti hiçbir ağ isteği yapmaz; analitik ve telemetri yoktur, geliştiriciye ya da üçüncü
taraflara veri gitmez. Uzaktan kod yüklemez, harici betik veya CDN kullanmaz. Yalnızca
`https://avukat.uyap.gov.tr/*` adresinde çalışır.

Sayfadan yalnız şunlar okunur:

- düğme, sekme ve seçenek etiketleri;
- banka sorgusu sonucundaki **No / Kurum** tablosundan banka adları, **Banka Seç** ve
  **Hesap Seç** listelerindeki satır adları, sayfalayıcıdaki kayıt sayısı ve sayfa numaraları;
- "... kaydı yok / bulunamadı" cümlesi çıkıp çıkmadığını anlamak için sayfa metninde yalnız
  bu kalıp aranır;
- UYAP'ın uyarı kutularının gövde metni (gövde boşsa başlığı). Bunlar sistem mesajlarıdır
  (limit, ücret, bakiye, yetki).

Okunmayanlar: dosya numarası, icra dairesi, alacaklı/borçlu ve taraf bilgileri, TCKN/VKN,
hesap numarası, bakiye, çerez ve oturum bilgisi. EGM, İcra Dosyası ve TAKBİS sonuç
tablolarından plaka, ada/parsel, dosya numarası gibi hiçbir alan okunmaz; o tablolarda yalnız
satırların ekleme düğmelerine basılır.

Saklananlar:

- **Banka adları** yalnız Chrome'un geçici (RAM) alanında (`chrome.storage.session`) durur,
  diske yazılmaz. Yeni bir çalıştırmada, iş bittiğinde ya da takıldığında, dosya
  penceresinden ayrıldığınızda, belleğe alınmasının üzerinden 10 dakika geçince ve Chrome
  kapanınca silinir.
- **Tercihler** (koyu/açık mod, haciz türü tikleri, ücret onayı) `chrome.storage.local`
  içinde kalır. Dosya veya kişi verisi değildir.

İzinler: `storage` (yukarıdaki geçici bellek ve tercihler), `alarms` (10 dakikalık silme
zamanlayıcısı), `scripting` (her çalıştırmada betikleri açık UYAP sekmesine yüklemek için)
ve yalnız `https://avukat.uyap.gov.tr/*` için site izni.

## Kaldırma

`chrome://extensions` sayfasında eklentinin kartındaki **Kaldır** düğmesine basın ve çıkan
soruyu **Kaldır** ile onaylayın. Tercihler eklentiyle birlikte silinir. İndirdiğiniz klasörü
de silebilirsiniz.

## Bilinen sınırlar

- Aynı türü arka arkaya iki kez çalıştırmayın: sonuç tablosu ekranda kaldığı için ikinci
  çalıştırma sorguyu yinelemez ve aynı kayıtları talebe bir kez daha ekler.
- Kurum borçlularda UYAP banka sorgusuna izin vermez; Banka satırı uyarıyla biter, diğer
  bölümlerden eklenen talepler yine evraka girer.
- Sayfa 10 dakika boyunca ilerleme bildirmezse popup "Bir şeyler ters gitti" der ve düğme
  yeniden açılır.
- Eklenti simgesine UYAP dışında bir sekmede basılırsa iş başlamaz.
