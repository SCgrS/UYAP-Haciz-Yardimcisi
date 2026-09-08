# UYAP Haciz Yardımcısı

UYAP Avukat Portalı'nda, takibin kesinleştiği bir borçlu seçildiğinde çalışır. Tercihe göre
EGM, icra dosyası, TAKBİS ve banka hacizlerini tek tek ya da toplu şekilde hazırlayan bir
Chrome eklentisidir. Sorguları sırayla yapar, çıkan kayıtların hepsini haciz talebine ekler ve
en sonda tek bir talep evrakı oluşturur. Talebi **göndermez**; son kontrol ve gönderme sizde
kalır.

Eklenti hiçbir ağ isteği yapmaz; analitik, telemetri ve uzaktan kod yükleme yoktur, hiçbir
yere veri göndermez. Sayfada yalnızca düğme, sekme ve etiket adlarını arar; dosya numarası,
TCKN/VKN, hesap numarası, bakiye gibi bilgileri okumaz. Diske veri yazmaz: banka adları
Chrome'un geçici belleğinde tutulur ve iş bitince, en geç Chrome kapanınca silinir. Ayrıntısı
[Gizlilik](#gizlilik) bölümünde.

Eklenti bağımsız bir geliştirici tarafından üretilmiş, yardımcı bir araçtır; UYAP ya da
Adalet Bakanlığı tarafından geliştirilmiş veya onaylanmış resmî bir ürün değildir.

## Ne yapar

- Dosya penceresindeki **Sorgular** sekmesinde EGM-TNB, İcra Dosyası ve TAKBİS kartlarını
  sırayla açıp sorgular; sonuç tablosundaki her satırı **Haciz Talebine Ekle** ile talebe ekler.
- EGM'de her araç için açılan **Haciz Şerhi** penceresinde **Haciz** seçeneğini işaretler.
- Banka sorgusundan çıkan bütün bankaları **Talep Gönder** sekmesinde tek tek seçer, tüm hesap
  türlerini işaretler, **89/1 Haciz İhbarnamesi**'ni seçip **Talep Ekle**'ye basar.
- En sonda **Talep Evrakı Oluştur** düğmesine basar; evrak indirilir ve akış burada durur.
- Hangi bölümün ne yaptığını (kaç kayıt eklendi, neden eklenmedi) canlı bir listede yazar;
  bir bölüm takılırsa durmaz, sıradaki bölüme geçer.
- UYAP bir kutuyla engellediğinde (60 dakika sınırı, bakiye, saat penceresi, kurum borçlusu)
  kutunun cümlesini olduğu gibi gösterir.
- Sorgu zaten yapılmış ve sonucu ekrandaysa sorguyu yinelemez; sorgu hakkı harcamaz.

## Kurulum

### [Chrome Web Mağazası'ndan ekle](CHROME_MAGAZA_BAGLANTISI)

1. Bağlantıya tıklayın, açılan sayfada **Chrome'a ekle**'ye basın.
2. Çıkan küçük pencerede **Uzantı ekle**'ye basın.
3. Adres çubuğunun sağındaki **yapboz parçası** simgesine tıklayıp listede eklentinin yanındaki
   **raptiye** simgesine basın; simge araç çubuğuna sabitlenir. Eklenti yalnız simgesine
   basınca çalıştığı için sabitlemek gerekir.

Üyelik, e-posta ya da ücret istemez. Kurulumdan sonra yapılacak bir ayar yoktur: dört haciz
türü de tikli, ücretli sorgu onayı kapalı başlar.

### Kaynak koddan

1. Bu depoyu indirin: sağ üstteki **Code > Download ZIP**, sonra dosyayı kalıcı bir klasöre
   çıkarın. Chrome eklentiyi bu klasörden çalıştırır; klasör silinirse eklenti durur.
2. Chrome'da adres çubuğuna `chrome://extensions` yazıp Enter'a basın.
3. Sağ üstteki **Geliştirici modu** anahtarını açın.
4. **Paketlenmemiş öğe yükle**'ye basıp çıkardığınız klasörü seçin.

### Güncelleme

Mağazadan kurduysanız Chrome yeni sürümü kendisi yükler. Kaynak koddan kurduysanız yeni
dosyaları aynı klasöre alıp `chrome://extensions` sayfasında eklentinin kartındaki **yenile**
okuna basın.

> Popup'ta **Eklentiyi yenileyin** yazıyorsa Chrome hâlâ eski sürümü çalıştırıyor demektir;
> aynı yenile okuna basın. Eklenti bu düzelene kadar hiçbir sorgu yapmaz.

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

## Gizlilik

Bu bölüm eklentinin gizlilik politikasıdır ve bütün sürümleri için geçerlidir.

Eklenti hiçbir ağ isteği yapmaz; analitik ve telemetri yoktur, geliştiriciye ya da üçüncü
taraflara veri gitmez, hiçbir veri satılmaz ya da devredilmez. Uzaktan kod yüklemez, harici
betik veya CDN kullanmaz. Yalnızca `https://avukat.uyap.gov.tr/*` adresinde çalışır; başka
hiçbir sitede çalışmaz, öteki sekmelerinizi görmez.

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
  içinde kalır. Dosya veya kişi verisi değildir; eklenti kaldırılınca silinir.

İstenen izinler ve nedenleri:

| İzin | Neden gerekiyor |
|---|---|
| `storage` | Yukarıdaki geçici bellek (banka adları) ve tercihler için. |
| `alarms` | Banka adlarını 10 dakika sonra bellekten silen zamanlayıcı için. |
| `scripting` | Her çalıştırmada eklentinin betiklerini açık UYAP sekmesine yüklemek için. |
| `https://avukat.uyap.gov.tr/*` | Eklentinin tıkladığı düğmeler bu sayfadadır; başka site izni istenmez. |

Sorunuz ya da bildirmek istediğiniz bir sorun olursa depodaki **Issues** sekmesinden
yazabilirsiniz.

## Kaldırma

Araç çubuğundaki eklenti simgesine sağ tıklayıp **Chrome'dan kaldır** deyin; ya da
`chrome://extensions` sayfasında eklentinin kartındaki **Kaldır** düğmesine basıp çıkan soruyu
**Kaldır** ile onaylayın. Tercihler eklentiyle birlikte silinir. Kaynak koddan kurduysanız
indirdiğiniz klasörü de silebilirsiniz.

## Bilinen sınırlar

- Aynı türü arka arkaya iki kez çalıştırmayın: sonuç tablosu ekranda kaldığı için ikinci
  çalıştırma sorguyu yinelemez ve aynı kayıtları talebe bir kez daha ekler.
- Kurum borçlularda UYAP banka sorgusuna izin vermez; Banka satırı uyarıyla biter, diğer
  bölümlerden eklenen talepler yine evraka girer.
- Sayfa 10 dakika boyunca ilerleme bildirmezse popup "Bir şeyler ters gitti" der ve düğme
  yeniden açılır.
- Eklenti simgesine UYAP dışında bir sekmede basılırsa iş başlamaz.
