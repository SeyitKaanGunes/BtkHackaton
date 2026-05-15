# UI/UX ve Performans Düzeltme Todo Listesi

Bu liste browser-use ile canlı arayüz kontrolü ve hızlı kod taraması sonrası hazırlandı. Kontrol edilen ana rotalar: `/dashboard`, `/categories`, `/spending-dna`, `/goals`, `/emotional-delay`, `/actions`, `/subscriptions`, `/portfolio`, `/business`, `/agent`.

## Kontrol Notları

- API ayakta: `GET /health` başarılı.
- Web ayakta: `GET /dashboard` başarılı.
- Browser-use ilk açılış gözlemi: `/dashboard` yaklaşık 4.4 sn, `/spending-dna` yaklaşık 1.7 sn, `/categories` yaklaşık 1.4 sn, `/portfolio` yaklaşık 1.1 sn. Sıcak HTTP ölçümünde rotalar 50-150 ms aralığında dönüyor; yavaşlık büyük olasılıkla dev build/chunk yükleme, client fetch waterfall, büyük global CSS ve sayfa açılışında çalışan ek isteklerden geliyor.
- Agent sayfasında network tarafında sayfa yükünden sonra `/speech/capabilities` ve `/agent/conversations` client istekleri geliyor.
- Global CSS içinde birden fazla hover `translateY` kuralı var; kartlar ve butonlar farklı katmanlarda tekrar tekrar etkileniyor.
- Üst bar `Bildirimler` ve `Yardım` butonları görünüyor ama handler/menü bağlı değil.
- Portföy üstündeki `Yenile` ve `Diğer` butonları görünüyor ama handler/menü bağlı değil.

## P0 - Önce Çözülmesi Gerekenler

- [x] Sayfa açılış performansını ölç ve optimize et.
  - Production build doğrulandı: lokal `.env` fail-fast kuralı nedeniyle ilk deneme localhost API URL ile bilinçli düştü; prod API URL override ile build geçti.
  - P0 kapsamındaki gereksiz başlangıç fetchleri azaltıldı: Agent speech capability isteği ilk kullanıma taşındı.
  - Dashboard SSR veri çağrıları sadeleştirildi; belge/portföy blokları özetten kaldırıldığı için bu veriler artık dashboard açılışında çekilmiyor.
  - Agent konuşma geçmişi API tarafında limitlenebilir hale getirildi; web başlangıçta yalnızca son 6 konuşma özetini çekiyor.
  - Büyük `globals.css` için P0 kritik override/tek yol düzeltmeleri yapıldı; tam görsel sistem sadeleştirmesi P1 içinde devam edecek.

- [x] Birbirine kaymış modülleri tek sahip sayfaya indir.
  - `/dashboard`: maaş değiştirme formu kaldırıldı; maaş/profil yönetimi `Finansal Profil` alanına bırakıldı.
  - `/dashboard`: belge upload/ekstre/fiş blokları kaldırıldı; sadece `/receipt` yönlendirmesi kaldı.
  - `/spending-dna`: gömülü What-if formu kaldırıldı; What-if canonical olarak `/what-if` içinde kaldı.
  - `/spending-dna`: `Hedeflerim` sekmesi kaldırıldı.
  - `/business`: KOBİ sayfasında sidebar artık farklı menüye sıçramıyor; ana shell sabit kalıyor.

- [x] Agent sayfasını gerçek sohbet deneyimine çevir.
  - Sağ rail kaldırıldı; ana alan sohbet oldu.
  - Mesaj gönderme alanı sohbet ekranının altında duruyor.
  - `Agent cevabı` başlıklı ayrı rapor kutusu kaldırıldı; yanıt Money Crab avatarlı karşı mesaj balonu olarak görünüyor.
  - `Model`, `Token`, teknik context boyutu ve grounding/debug metinleri kullanıcı arayüzünden kaldırıldı.
  - Agent node zinciri son yanıtın hemen üstünde küçük yatay chip olarak gösteriliyor.
  - Node'a tıklanınca yalnızca ilgili node'un kısa açıklaması açılıyor.
  - Money Crab avatarı agent mesajlarında görünüyor.

- [x] Portföyde kullanıcıya sızan Twelve Data hata metnini temizle.
  - Teknik provider hata metni UI'dan kaldırıldı.
  - Fiyat alınamayan varlıklarda kısa ürün mesajı gösteriliyor: `Piyasa fiyatı alınamadı`.
  - USDTRY gibi kompakt döviz sembolleri provider formatına normalize ediliyor.
  - AAPL için varsayılan NASDAQ exchange gönderiliyor.

- [x] Mock/no-op butonları gerçek aksiyona bağla veya kaldır.
  - Üst bar `Bildirimler` artık `/actions` linki.
  - Üst bar `Yardım` artık `/agent` linki.
  - Portföy `Yenile` mevcut portföy route'unu yeniden açan linke çevrildi.
  - Portföy `Diğer` kaldırıldı.
  - Bu P0 turunda tespit edilen çalışmayan görsel butonlar ya linke çevrildi ya kaldırıldı.

## P1 - Görsel Tutarlılık ve Minimalizm

- [x] Button sistemini standartlaştır.
  - Primary, secondary, ghost, icon button için tek boyut ve radius override eklendi.
  - Aynı seviyedeki butonlar aynı yükseklik/padding/weight çizgisine çekildi.
  - Beyaz/secondary hover'ında mavi dolgu davranışı kaldırıldı; hafif arka plan + border/focus vurgusu kullanılıyor.
  - Aksiyon merkezi `Onayla` ve `Reddet` butonları satır sağında hizalanıyor.

- [x] Kart hover transform'larını kaldır.
  - P1 canonical override ile kart/button hover hareketleri `transform: none` çizgisine indirildi.
  - Hover artık border/background/shadow yoğunluğu üzerinden çalışıyor.
  - Davranış portföy, aksiyon merkezi, modül kartları, category row ve secondary buttonlarda tutarlı.

- [x] Para formatını tek helper'a indir.
  - Web için `formatCurrency` / `formatCurrencyText` helper'ı eklendi.
  - TRY gösterimi kullanıcı yüzeylerinde `₺54.546` formatına çekildi.
  - Form input label'larında para birimi açık hale getirildi: `Tutar (₺)`, `Limit (₺)`, vb.
  - Abonelik yönetiminde `TRY / ay` yerine `₺279/ay` çizgisi kullanılıyor.

- [x] Kategori dağılımını görsel olarak iyileştir.
  - Her kategori satırına anlamlı icon eklendi.
  - Icon renkleri kategori rengiyle uyumlu.
  - Kategori dağılımına yarım donut grafik eklendi.
  - Kategori satırları button olarak kaldı; drawer açma ve klavye erişimi korunuyor.

- [x] Spending DNA sağ kolonunu sıkılaştır.
  - `Hızlı Aksiyon Önerileri` boşlukları azaltıldı.
  - Öneriler compact link/list item görünümüne çekildi.
  - Sağ kolon kart yükseklikleri daha kontrollü hale getirildi.

- [x] Spending DNA kategori risklerini kısalt.
  - İlk 5 kritik kategori gösteriliyor.
  - Devamı native expandable `Tüm riskleri gör` alanında açılıyor.
  - İlk görünümde kart yüksekliği kısaldı.

- [x] Spending DNA LLM yorum durumunu ürünleştir.
  - `Yorum / Ulaşılamadı / Risk skorları hızlı yüklendi...` metni kaldırıldı.
  - LLM yorumu yoksa bölüm hiç görünmüyor.
  - LLM yorumu varsa kısa yorum kartı olarak gösteriliyor.

- [x] Hedefler sayfasındaki uzun kartları compact hale getir.
  - `detail-stat-card plan-stat-card` padding ve metin yoğunluğu azaltıldı.
  - Koç cevabı kısa özet + en fazla 3 aksiyon maddesi gösteriyor.
  - Aynı hedef/bütçe verisinde session cache kullanılıyor; sayfa değiştirip dönünce tekrar LLM beklenmiyor.
  - `Tavsiyeyi yenile` cache'i temizleyip bilinçli yeniden üretim yapıyor.

- [x] Hedefler `Kategori harcama limitleri` bölümünü kısalt.
  - İlk 6 kategori gösteriliyor.
  - Kalan kategoriler `Tüm kategorileri düzenle` expandable alanına taşındı.
  - Kaydet butonları satır içinde tutarlı boyutta hizalandı.

- [x] Emotional Delay hero/sonuç metnini sadeleştir.
  - Hero metni `Önerilen bekleme süresi` diliyle sadeleştirildi.
  - Açıklama kısa ve kullanıcıya dönük hale getirildi.
  - Kontrast beyaz zemin üstünde okunur hale getirildi.
  - Sonuç kartındaki boş/soluk görünüm azaltıldı.

- [x] Abonelik Avcısı chip boyutlarını küçült.
  - `chip accent` statüleri kompakt pill ölçüsüne çekildi.
  - `Aktif`, `İzleniyor`, `İptal edildi`, `Yok sayıldı` statüleri küçük ve okunur.
  - Yönetim satırlarında buton/chip hizası sıkılaştırıldı.

## P2 - Portföy ve KOBİ Ürün Akışı

- [x] Portföy varlık ekleme akışını tek canonical yola indir.
  - Ana portföy sayfasındaki küçük `panel investment-form` kaldır.
  - `Varlık Ekle` butonu modal/drawer veya `/portfolio/add` sayfasını açsın.
  - Ana sayfa sadece özet, dağılım, varlık listesi ve portföy ikizi içersin.
  - Ana sayfa artık inline form render etmiyor; form yalnızca `/portfolio/add` içindeki focused akışta var.

- [x] Portföy liste satırlarını temizle.
  - Fiyat alınamayan varlıklarda teknik hata yerine kısa UI durumu kullan.
  - `Alınamadı`, `Hesaplanamadı` metinleri daha ürün diliyle değiştirilsin.
  - Sil butonu yanında hover/confirm davranışı net olsun.
  - Teknik provider hataları kullanıcıya sızmıyor; fiyat yoksa `Piyasa verisi yok`, kar/zarar için `Kar/zarar bekliyor` gösteriliyor.
  - Silme işlemi tek tıkla DB değişikliği yapmıyor; önce satır içinde `Silinsin mi?` onayı açılıyor.

- [x] KOBİ/personal hesap geçişini düzgün hale getir.
  - KOBİ sayfasına gidince sidebar tamamen farklılaşmamalı.
  - Kullanıcının hem kişisel hem KOBİ hesabı varsa üst barda hesap alanı değiştirici sun.
  - Sidebar ana ürün navigasyonu sabit kalsın; KOBİ alt modülleri sayfa içi tab/section nav olarak gösterilsin.
  - KOBİ içindeki bozuk Türkçe karakterler düzelt: `Maas �demeleri`, `Ofis kirasi`, `tahsilati` vb.
  - Üst bara `Kişisel / KOBİ` switcher eklendi.
  - KOBİ alt modülleri sidebar yerine sayfa içi yatay nav ile açılıyor.
  - Kod taramasında mojibake/bozuk Türkçe karakter kalmadığı doğrulandı.

## P3 - Sayfa Bazlı Küçük Düzeltmeler

- [x] `/dashboard`
  - Maaş düzenleme ve belge import blokları kaldırılmalı.
  - Özet ekran sadece özet + en kritik yönlendirmeler olmalı.
  - Hızlı işlem kartları sadeleşmeli.
  - Dashboard yalnızca dönem metrikleri, trend, manuel hızlı kayıt ve kritik yönlendirmelerden oluşuyor; maaş/profil Finansal Profil'e, belge import `/receipt` alanına taşındı.

- [x] `/categories`
  - Kategoriler ikonlu ve renkle eşleşmiş olmalı.
  - Yarım daire/donut grafik eklenecek.
  - Liste hover davranışı grafikle senkron çalışmalı.
  - Kategori dağılımı ikonlu satırlar, kategori rengine bağlı yarım donut ve drawer detay akışıyla çalışıyor.

- [x] `/spending-dna`
  - What-if ve hedef sekmeleri sadeleştirilmeli.
  - Hızlı aksiyon listesi compact yapılmalı.
  - Kategori riskleri expandable hale getirilmeli.
  - LLM yorum hata/durum metni kaldırılmalı.
  - What-if kendi rotasında, hedefler kendi rotasında kaldı; riskler expandable, hızlı aksiyonlar compact ve LLM yoksa yorum bölümü render edilmiyor.

- [x] `/goals`
  - Koç cevabı cache'lenmeli.
  - Uzun stat kartları compact hale getirilmeli.
  - Kategori limitleri drawer/modal ile yönetilmeli.
  - Hedef koçu session cache kullanıyor; kategori limitlerinin devamı artık sağ drawer üzerinden düzenleniyor.

- [x] `/emotional-delay`
  - Açıklama metni ve kontrast düzeltilecek.
  - Büyük boş sonuç alanı azaltılacak.
  - Karar aksiyon butonları sadece geçerli senaryo sonrası aktif ve anlaşılır olacak.
  - Hero metni okunur hale getirildi; sonuç alanı sıkılaştırıldı ve karar aksiyonları senaryo bağlamında gösteriliyor.

- [x] `/actions`
  - Onay/reddet butonları satır sağında hizalanacak.
  - Hover transform kaldırılacak.
  - Secondary hover kontrastı düzeltilecek.
  - Aksiyon satırları sağ hizalı butonlarla çalışıyor; hover hareketi kaldırıldı ve secondary hover okunur.

- [x] `/subscriptions`
  - Chip/pill ölçüleri küçültülecek.
  - Para formatı birleştirilecek.
  - Yönetim satırları daha kompakt hale getirilecek.
  - Abonelik status chipleri compact, tutarlar `₺.../ay` formatında ve yönetim satırları sıkı hizalı.

- [x] `/portfolio`
  - Twelve Data hata sızıntısı temizlenecek.
  - Header butonları bağlanacak.
  - Inline varlık ekleme formu kaldırılacak.
  - Teknik fiyat sağlayıcı hataları UI'a sızmıyor; header aksiyonları linkli ve ekleme formu yalnızca `/portfolio/add`.

- [x] `/business`
  - Sidebar değişimi yerine hesap switcher + sayfa içi KOBİ nav uygulanacak.
  - Bozuk Türkçe karakterler düzeltilecek.
  - KOBİ asistanı cevabı daha compact ve sohbet hissine yakın gösterilecek.
  - Sidebar sabit; üst bar hesap switcher ve sayfa içi KOBİ nav aktif. DB'deki bozuk KOBİ nakit başlıkları düzeltildi.

- [x] `/agent`
  - Chat-first tasarıma geçilecek.
  - Teknik kalite/debug bilgileri kullanıcıdan gizlenecek.
  - Agent node zinciri interaktif ve minimal yapılacak.
  - Sağ rail opsiyonel/daha küçük hale getirilecek.
  - Agent ekranı chat-first; debug/model/token bilgileri gizli, node zinciri tıklanabilir chip yapısında ve sağ rail kaldırıldı.

## P4 - Son Visual QA ve Teknik Temizlik

- [x] Browser-use ile gerçek sayfa geçişlerini tekrar doğrula.
  - Browser-use bağlantısı bu turda kuruldu.
  - İlk QA turunda business hesap guard'ı yüzünden kişisel rotaların `/business`'a döndüğü görüldü.
  - `requirePersonalSession` canonical olarak tüm auth kullanıcıların kişisel finans ekranlarına erişebileceği hale getirildi; KOBİ ekranı hâlâ business kaydı gerektiriyor.
  - Browser-use screenshot capture komutu bu ortamda zaman aşımına düştü; aynı browser oturumunda route, visible DOM, viewport ve console QA tamamlandı.

- [x] Desktop route QA tamamla.
  - `/dashboard`, `/categories`, `/spending-dna`, `/goals`, `/emotional-delay`, `/actions`, `/subscriptions`, `/portfolio`, `/business`, `/agent` browser-use ile 1512x982 viewport'ta gezildi.
  - Ek form/akış rotaları da kontrol edildi: `/financial-profile`, `/what-if`, `/receipt`, `/portfolio/add`.
  - Teknik hata/debug metinleri, provider hatası, eski duplicate modül metinleri ve console error kontrol edildi.
  - Sıcak browser süreleri yaklaşık 1.0-1.9 sn aralığına indi; en yavaş rotalar `/dashboard` ve `/actions`.

- [x] Mobil/tablet responsive QA tamamla.
  - Browser viewport override ile 390x844 ve 834x1112 breakpoint'leri kontrol edildi.
  - Ek form rotaları 390x844 mobil viewport'ta ayrıca smoke edildi.
  - Yatay taşma, login redirect, ana içerik erişimi ve kritik eski metin sızıntıları tarandı.

- [x] CSS hover/override çakışmalarını azalt.
  - Eski image-to-code katmanlarından kalan `translateY` hover hareketleri canonical `transform: none` çizgisine çekildi.
  - Son override bloğu artık kart/button davranışını tek görsel sisteme sabitliyor.

- [x] Son UI metin/para/ikon tutarlılığını tekrar tara.
  - `TRY / ay`, teknik Twelve Data hata metni, `Agent cevabı`, `Model:`, `Token:` ve `Ulaşılamadı` gibi kullanıcıya çıkmaması gereken metinler route snapshot'larında bulunmadı.
  - Kategori ikonları, para birimi etiketleri ve compact chip/button stilleri korunuyor.

- [x] Commit öncesi kalite testleri çalıştır.
  - Web/API typecheck, web production build, shared build, route smoke, `git diff --check` ve browser-use QA tamamlandı.

## Kabul Kriterleri

- [x] Her sayfa browser-use ile 1512x982 ve mobil viewport'ta kontrol edildi.
  - Bu P4 turunda browser-use bağlantısı kuruldu; desktop + mobil/tablet route QA tamamlandı.
- [x] Her P3 sayfası auth'lu SSR ile 200 döndü ve beklenen/kaldırılması gereken metinler otomatik tarandı.
- [x] Kullanıcıya teknik provider hata metni görünmüyor.
- [x] Çalışmayan buton kalmadı.
- [x] Aynı ürün sorumluluğu iki ayrı sayfada ana form olarak tekrar etmiyor.
- [x] Kart ve buton hover davranışı tek tasarım sisteminden geliyor.
- [x] Para formatı tüm web'de tek standarda indi.
- [x] Agent ekranı teknik rapor değil, gerçek sohbet deneyimi gibi çalışıyor.
- [x] Production build ve web typecheck geçiyor.
