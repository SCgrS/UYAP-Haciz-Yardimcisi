# UYAP Haciz Yardımcısı

UYAP Avukat Portalı'nda, takibin kesinleştiği bir borçlu seçildiğinde çalışır. Tercihe göre
EGM, icra dosyası, TAKBİS ve banka hacizlerini tek tek ya da toplu şekilde hazırlayan bir
Chrome eklentisidir. Sorguları sırayla yapar, çıkan kayıtların hepsini haciz talebine ekler ve
en sonda tek bir talep evrakı oluşturur. Talebi **göndermez**; son kontrol, imza ve gönderme kullanıcıda
kalır.

Eklenti hiçbir ağ isteği yapmaz; analitik, telemetri ve uzaktan kod yükleme yoktur, hiçbir
yere veri göndermez. Sayfada yalnızca düğme, sekme ve etiket adlarını arar; dosya numarası,
TCKN/VKN, hesap numarası, bakiye gibi bilgileri okumaz. Diske veri yazmaz: banka adları
Chrome'un geçici belleğinde tutulur ve iş bitince, yeni sorgulama yapıldığında veya en geç Chrome kapanınca kalıcı olarak Chrome geçici belleğinden silinir.

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

## Kullanım

1. UYAP Avukat Portalı'nda kesinleşmiş bir takip dosyasını açın.
2. **Taraf Bilgileri** sekmesinden bir borçlu seçin.
3. Araç çubuğundaki eklenti simgesine tıklayın ve istenen haciz türlerini seçin.
4. **Toplu Haczi Hazırla**'ya basın.

> İşlem sürerken sayfada bir yere tıklamayın; sıralamayı ve işlemleri sekteye uğratabilirsiniz.
> Bu uyarı çalışma boyunca durum çubuğunun altında da durur.

| Öğe | Ne yapar |
|---|---|
| **EGM**, **İcra dosyası**, **TAKBİS**, **Banka** | Hangi haciz türlerinin hazırlanacağı. Dördü de varsayılan olarak açıktır; tiki kaldırılan tür hiç sorgulanmaz ve listeye satırı düşmez. |
| **Ücretli sorguyu onayla** | Ücretsiz hak bittiğinde UYAP'ın açtığı "... ücret alınacaktır" kutusunu onaylar. Varsayılan olarak kapalıdır; kapalıyken kutu **İptal** ile kapatılır ve o bölüm geçilir. |
| **Toplu Haczi Hazırla** | Tikli türleri, tikleme sırasına bakmadan hep aynı sırayla hazırlar: EGM, icra dosyası, TAKBİS, banka. En sonda **Talep Evrakı Oluştur**'a basar ve evrak indirilir; hepsi tek evrakta toplanır. Talebe hiç kayıt girmediyse evrak oluşturulmaz. Hiçbir tür tikli değilse "En az bir haciz türü seçin" yazar. |
| **Yeni Sorgu Yap** | Yalnız bir çalıştırma bittiğinde görünür. Ekranda duran sonucu ve tür satırlarını kaldırıp durumu **Hazır**'a döndürür; popup'ı kapatıp açmadan yeni bir sorgu yapılabilir. Sayfada yapılmış bir işi geri almaz, yalnız ekranı temizler. |
| **Nasıl kullanılır?** (Toplu Haciz bölümünün altı) | Tıklayınca kısa kullanım notları açılır, yeniden tıklayınca kapanır. |
| Sağ üstteki güneş/ay düğmesi | Koyu / açık mod. |

### Sonuç

Çalışırken durum çubuğu o an ne yapıldığını yazar. Altında seçili her tür için bir satır durur:
yeşil bitti, turuncu takıldı, mavi çalışıyor demektir. Satırın yanında sonucu yazar — "3 kayıt
haciz talebine eklendi" ya da takıldıysa nedeni.

İş bittiğinde kutu yeşile döner ve kaç kayıt için talep evrakı oluşturulduğunu türlere ayırarak
özetler. Bir bölüm takıldıysa kutu turuncuya döner; hazırlanan talep eksiktir, göndermeden önce
bakın. Liste, dosya penceresini kapatana, başka bir dosya açana ya da **Yeni Sorgu Yap**'a
basana kadar ekranda kalır.

### UYAP sorguyu engellediğinde

UYAP bir sorguyu engellediğinde (60 dakika sınırı, yetersiz bakiye, saat penceresi, kurum
borçlusu, ücret onayı) bunu bir kutuyla bildirir. Eklenti kutudaki cümleyi olduğu gibi o
bölümün satırına yazar, kutuyu kapatır ve beklemeden sıradaki bölüme geçer.

Borçlunun o türde kaydı yoksa bu bir hata değildir; bölüm "Araç kaydı yok" gibi bir notla
biter. Beklenen bir öğe hiç gelmezse durum çubuğunda "Bir şeyler ters gitti" yazar, altında
nerede durulduğu belirtilir.

## Ne yapmaz

- **Evrak Gönder**'e basmaz; talebi icra dairesine göndermez.
- Ödeme türü seçmez, ödeme ekranını açmaz.
- İki düğmeli hiçbir onay kutusuna kendiliğinden dokunmaz. Ücret kutusuna yalnız
  **Ücretli sorguyu onayla** açıkken basar.
- Bir bölüm yarıda kaldığında ekranda kalan kutuyu yalnız "vazgeç" anlamına gelen düğmeyle
  (ücret kutusunda **İptal**, tek düğmeli bilgi kutusunda **Tamam**) kapatır; hiçbir zaman
  onaylayarak kapatmaz.
- Emin olunamayan hiçbir bankayı işaretlemez; eşleşmeyen banka olursa banka bölümü durur.
- Sorgu sonucunun bir kısmını ekleyip kalanını atlamaz: sayfalayıcının bildirdiği kayıt
  sayısına ulaşılamazsa o bölüm hata ile durur.
- Hukuki değerlendirme yapmaz. Gönderilecek talebin doğruluğundan talebi gönderen sorumludur.

## Gizlilik

Bu bölüm eklentinin gizlilik politikasıdır ve bütün sürümleri için geçerlidir.

Eklenti hiçbir ağ isteği yapmaz; analitik ve telemetri yoktur, geliştiriciye ya da üçüncü
taraflara veri gitmez, hiçbir veri satılmaz ya da devredilmez. Uzaktan kod yüklemez, harici
betik veya CDN kullanmaz. Yalnızca `https://avukat.uyap.gov.tr` sayfalarında çalışır.

Sayfadan okunanlar:

- düğme, sekme ve seçenek etiketleri;
- banka sorgusu sonucundaki banka adları, **Banka Seç** ve **Hesap Seç** listelerindeki satır
  adları, sayfalayıcıdaki kayıt sayısı;
- "... kaydı yok / bulunamadı" cümlesinin çıkıp çıkmadığı;
- UYAP'ın uyarı kutularının metni (limit, ücret, bakiye, yetki gibi sistem mesajları).

Okunmayanlar:

- dosya numarası, icra dairesi, alacaklı ve borçlu bilgileri, TCKN/VKN;
- hesap numarası, bakiye;
- çerez ve oturum bilgisi;
- EGM, İcra Dosyası ve TAKBİS sonuç tablolarındaki plaka, ada/parsel gibi alanlar; o tablolarda
  yalnız satırların ekleme düğmelerine basılır.

Tutulanlar:

- **Banka adları** yalnız Chrome'un geçici belleğinde durur, diske yazılmaz. Şunlardan biri
  olduğunda silinir:
  - yeni bir çalıştırma başladığında,
  - iş bittiğinde ya da bir bölüm takıldığında,
  - dosya penceresinden ayrıldığınızda,
  - belleğe alınmasının üzerinden 10 dakika geçtiğinde,
  - Chrome kapandığında.
- **Tercihler** (koyu/açık mod, haciz türü tikleri, ücret onayı) Chrome'un eklenti deposunda,
  bilgisayarınızda kalır. Dosya ya da kişi verisi değildir; eklenti kaldırılınca silinir.

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
- Eklenti yalnızca simgeye bastığınız sekmede çalışır; arkada duran başka bir UYAP
  sekmesine dokunmaz. Aynı anda iki dosyada birden çalıştırmayın.
- Popup'ta **Eklentiyi yenileyin** yazıyorsa Chrome hâlâ eski sürümü çalıştırıyor demektir;
  `chrome://extensions` sayfasındaki **yenile** okuna basın. Eklenti bu düzelene kadar hiçbir
  sorgu yapmaz.

## Teşekkür

Bu eklentideki banka haciz ekleme akışı, Raci Çetin Yüksekbaş'ın fikir önerisi üzerine
oluşturulmuştur, kendisine teşekkür ederim.

---

Sorunuz ya da bildirmek istediğiniz bir şey olursa: [x.com/CgrShn](https://x.com/CgrShn)

Lisans: MIT. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakınız.
