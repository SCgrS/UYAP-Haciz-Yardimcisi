# UYAP Haciz Yardımcısı

UYAP Avukat Portalı'nda, takibin kesinleştiği bir borçlu seçildiğinde çalışır. Tercihe göre EGM, icra dosyası, TAKBİS ve banka hacizlerini tek tek ya da toplu şekilde hazırlayan bir Chrome eklentisidir. Sorguları sırayla yapar, çıkan kayıtların hepsini haciz talebine ekler ve en sonda tek bir talep evrakı oluşturur. Talebi göndermez; son kontrol, imza ve gönderme kullanıcıda kalır.

Eklenti hiçbir ağ isteği yapmaz; analitik, telemetri ve uzaktan kod yükleme yoktur, hiçbir yere veri göndermez. Sayfada yalnızca düğme, sekme ve etiket adlarını arar; dosya numarası, TCKN/VKN, hesap numarası, bakiye gibi bilgileri OKUMAZ. Kullanıcının kendi diskine dahi veri yazmaz: Banka adları kullanıcının Chrome'unun geçici belleğinde tutulur ve iş bitince, yeni sorgulama yapıldığında veya en geç Chrome kapanınca kalıcı olarak Chrome geçici belleğinden silinir.

Eklenti bağımsız bir geliştirici tarafından üretilmiş, yardımcı bir araçtır; UYAP veya Adalet Bakanlığı tarafından geliştirilmiş bir ürün değildir.

---

## Ne yapar

- Bir icra dosyasında, Borçlu Bilgileri sekmesinde takibi kesinleşmiş bir borçlu seçildikten sonra, eklentideki butona basıldığında EGM-TNB, İcra Dosyası ve TAKBİS kartlarını sırayla açıp sorgular; sonuç tablosundaki her satırı "Haciz Talebine Ekle" ile talebe ekler.
- EGM'de her araç için açılan Haciz Şerhi penceresinde "Haciz" seçeneğini işaretler.
- Banka sorgusundan çıkan bütün bankaları Talep Gönder sekmesinde tek tek seçer, tüm hesap türlerini işaretler, 89/1 Haciz İhbarnamesi'ni seçip "Talep Ekle"ye basar.
- En sonda "Talep Evrakı Oluştur" düğmesine basar; evrak indirilir ve akış orada durur.
- Hangi bölümün ne yaptığını (kaç kayıt eklendi, neden eklenmedi) canlı bir listede yazar. Bir bölüm takılırsa durmaz, sıradaki bölüme geçer.
- UYAP bir kutuyla engellediğinde (60 dakika sınırı, yetersiz bakiye, saat penceresi, kurum borçlusu) kutunun cümlesini olduğu gibi gösterir.
- Sorgu zaten yapılmış ve sonucu ekrandaysa sorguyu yinelemez; boş yere sorgu hakkı harcamaz.

---

## Kurulum

### [Chrome Web Mağazası'ndan ekle](https://chromewebstore.google.com/detail/jhejmhbhkdlamabcdmonlobfeepillpj?utm_source=item-share-cb)

1. Bağlantıya tıklayın, açılan sayfada **Chrome'a ekle**'ye basın.
2. Çıkan küçük pencerede **Uzantı ekle**'ye basın.
3. Adres çubuğunun sağındaki **yapboz parçası** simgesine tıklayıp listede eklentinin yanındaki
   **raptiye** simgesine basın; simge araç çubuğuna sabitlenir. Eklenti yalnız simgesine
   basınca çalıştığı için sabitlemek gerekir.

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

---

## Nasıl kullanılır

1. UYAP Avukat Portalı'nda bir icra dosyası açın.
2. Borçlu Bilgileri sekmesinden bir takibi kesinleşmiş borçlu seçin.
3. Araç çubuğundaki eklenti simgesine tıklayın ve istediğiniz haciz türlerini seçin.
4. "Toplu Haczi Hazırla"ya basın.

İşlem sürerken sayfada bir yere tıklamayın; sıralamayı sekteye uğratabilirsiniz.

Kurulumdan sonra yapılacak bir ayar yoktur: dört haciz türü de seçili, ücretli sorgu onayı kapalı başlar. Eklenti, üyelik, e-posta ya da ücret istemez.

---

## Ayarlar

- **EGM / İcra dosyası / TAKBİS / Banka:** Hangi türlerin hazırlanacağı. Dördü de varsayılan olarak açıktır; tiki kaldırılan tür hiç sorgulanmaz.
- **Ücretli sorguyu onayla:** Ücretsiz hak bittiğinde UYAP'ın açtığı "... ücret alınacaktır" kutusunu onaylar. Varsayılan olarak KAPALIDIR; kapalıyken kutu İptal ile kapatılır ve o bölüm geçilir.
- **Yeni Sorgu Yap:** Ekranda duran sonucu temizleyip durumu Hazır'a döndürür.
- Koyu / açık mod.

---

## Ne yapmaz

- "Evrak Gönder"e basmaz; talebi icra dairesine göndermez.
- Ödeme türü seçmez, ödeme ekranını açmaz.
- İki düğmeli hiçbir onay kutusuna kendiliğinden dokunmaz. Ücret kutusuna yalnız siz seçeneklerden onay verdiğinizde basar.
- Emin olunamayan hiçbir bankayı işaretlemez; eşleşmeyen banka olursa banka bölümü durur.
- Sorgu sonucunun bir kısmını ekleyip kalanını atlamaz; beklenen kayıt sayısına ulaşılamazsa o bölüm hata ile durur.
- Gönderilecek talebin doğruluğundan talebi gönderen sorumludur.

---

## Gizlilik

Eklenti hiçbir ağ isteği yapmaz. Analitik ve telemetri yoktur; geliştiriciye ya da üçüncü taraflara veri gitmez, hiçbir veri satılmaz veya devredilmez. Uzaktan kod yüklemez, harici betik veya CDN kullanmaz. Yalnızca https://avukat.uyap.gov.tr sayfalarında çalışır.

Sayfadan yalnızca düğme, sekme ve etiket adları ile bankaların adları okunur. Dosya numarası, icra dairesi, alacaklı ve borçlu bilgileri, TCKN/VKN, hesap numarası, bakiye, plaka, ada/parsel gibi bilgiler okunmaz.

Kullanıcının kendi diskine dahi veri yazmaz. Banka adları yalnızca kullanıcının Chrome'unun geçici belleğinde tutulur; iş bittiğinde, yeni sorgu başladığında, dosyadan ayrıldığınızda, 10 dakika sonra ya da en geç Chrome kapandığında silinir. Tercihleriniz (koyu/açık mod, tikler) bilgisayarınızda kalır ve eklenti kaldırılınca silinir.

---

## Bilinen sınırlar

- Eklenti yalnızca simgeye bastığınız sekmede çalışır. Aynı anda iki dosyada birden çalıştırmayın.

---

## Teşekkür

Bu eklentideki banka haciz ekleme akışı, Raci Çetin Yüksekbaş'ın fikir önerisi üzerine oluşturulmuştur, kendisine teşekkür ederim.

---

Soru ve bildirimler için: [x.com/CgrShn](https://x.com/CgrShn)

Lisans: MIT. Ayrıntılar için [LICENSE](LICENSE) dosyasına bakınız.
