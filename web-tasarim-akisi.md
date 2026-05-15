# Fintwin Web Tasarım Akışı

Bu doküman Fintwin web yüzeyinin yeni canonical tasarım akışını tarif eder. Amaç, landing ve uygulama ekranlarını sade, güven veren ve finansal karar akışına odaklanan tek bir tasarım sistemiyle hizalamaktır.

## 1. Public Landing

- Kullanıcı amacı: Ürünün ne yaptığını hızlı anlamak ve giriş/kayıt ekranına geçmek.
- Ana modüller: Üst nav, kısa hero, ürün önizleme paneli, modül grid'i, dört adımlı ürün akışı, güvenlik/onay ilkeleri, final CTA.
- Yerleşim: Açık zemin, geniş hero, sağda dashboard benzeri ürün önizlemesi. Feature alanında 12 kolonluk boşluksuz grid.
- State: Landing veri çağırmaz; hata/loading state yoktur. CTA'lar `/login` ve sayfa içi akışa gider.
- Motion: İlk yüklemede GSAP ile hafif fade/float. Hover'lar CSS transition.
- Responsive: Nav linkleri dar ekranda sadeleşir, hero tek kolona düşer.

## 2. Login / Register / OAuth

- Kullanıcı amacı: Kişisel veya KOBİ hesabıyla giriş yapmak, kayıt olmak veya Google OAuth ile devam etmek.
- Ana modüller: Auth panel, account type selector, login/register tabs, Google butonu, hata mesajı.
- Yerleşim: Ortalanmış geniş auth panel; sol tarafta ürün vaadi, sağda form. Mobilde tek kolon.
- State: API hatası form üzerinde açık gösterilir. OAuth callback ayrı işlem ekranı gösterir.
- Motion: Panel entrance CSS/GSAP fade; form state değişimleri sade transition.
- Responsive: Form alanları taşmaz; Google butonu tam genişlik kalır.

## 3. Ortak Authenticated App Shell

- Kullanıcı amacı: Modüller arasında hızlı gezmek ve her ekrandan agent'a ulaşmak.
- Ana modüller: Sol navigasyon, brand, logout, güvenlik notu, workspace alanı, agent launcher.
- Yerleşim: Desktop'ta sabit sol sidebar + geniş içerik. Mobilde top nav davranışı.
- State: Aktif route vurgulanır. Personal ve KOBİ nav grupları ayrı tutulur.
- Motion: Nav item hover yumuşak yükselir. Agent modal state geçişi sade kalır.
- Responsive: Sidebar mobilde yatay scroll nav'a döner.

## 4. Özet Dashboard

- Kullanıcı amacı: Finansal durumun kısa özetini görmek, hızlı işlem/belge eklemek, detay modüllere geçmek.
- Ana modüller: Header, dönem sekmeleri, finansal sağlık paneli, metrik grid, portföy/hedef hızlı kartları, manuel işlem paneli, belgeyle hızlı kayıt, belge geçmişi.
- Yerleşim: Dashboard üstte karar özeti, ortada hızlı girişler, altta geçmiş/operasyon panelleri.
- State: Veri yoksa skor `--`, limit `Beklemede`, açıklayıcı empty state.
- Motion: Kart hover ve panel entrance düşük yoğunluklu.
- Responsive: Metric ve module grid tek kolona düşer.

## 5. Analiz Sayfaları

- Kullanıcı amacı: Kategori, Spending DNA, What-if, Emotional Delay ve hedef analizlerini ayrı ayrı incelemek.
- Ana modüller: Workspace header, summary metric grid, ana analiz paneli, gerekçe/uyarı listeleri, ilgili form veya simülasyon paneli.
- Yerleşim: Her analiz sayfası aynı panel diliyle açılır; grafik ve detaylar ayrı section olarak devam eder.
- State: Eksik veri durumunda fake sonuç yok; kullanıcıya hangi veri gerektiği söylenir.
- Motion: Sadece panel hover/entrance; hesaplanan sonuçlar stabil kalır.
- Responsive: Grafikler ve tablolar yatay taşmadan tek kolona iner.

## 6. Belge / Fiş / Ekstre Akışı

- Kullanıcı amacı: Fiş veya ekstre dosyasını kontrollü şekilde işlem geçmişine dönüştürmek.
- Ana modüller: Upload zone, preview rows, uyarı/güven sinyalleri, seçili kalem confirm, belge geçmişi, belge detay ekranı.
- Yerleşim: Upload alanı üstte tek panel, preview satırları altında geniş liste.
- State: OCR/API hatası açık gösterilir; düşük güven satırları uyarı üretir; boş seçim backend tarafından reddedilir.
- Motion: Upload/preview geçişi fade; checkbox ve confirm CTA net kalır.
- Responsive: Preview satırları mobilde iki satırlı kart listesine döner.

## 7. Agent / Aksiyon / Abonelik

- Kullanıcı amacı: Finansal ikize soru sormak, önerilen aksiyonları onaylamak, abonelik sızıntılarını yönetmek.
- Ana modüller: Agent chat, kalite sinyali, agent chain, structured action proposal, suggested actions, conversation history, abonelik status kontrolleri.
- Yerleşim: Agent ekranı iki akışlı: soru/cevap ana alanı, sağ/alt hafıza ve öneriler.
- State: LLM yoksa sessiz fallback yok; hata açık gösterilir. Proposal onay gerektirir, otomatik yazım yoktur.
- Motion: Mesaj ve öneri kartları hafif entrance; modal açılışı sade.
- Responsive: Agent paneli mobilde tam ekran modal hissi verir.

## 8. Portföy ve KOBİ

- Kullanıcı amacı: Yatırım durumunu, fiyat veri eksiklerini, KOBİ nakit akışını ve tahsilat riskini görmek.
- Ana modüller: Portföy özeti, pozisyon listesi, varlık ekleme, portföy ikizi; KOBİ dashboard, cashflow, coverage, collections, scenarios, records.
- Yerleşim: Portföyde özet + tablo; KOBİ'de business nav seçimine göre tek ana section.
- State: Fiyat yoksa fake P/L yok; KOBİ verisi yoksa onboarding paneli açılır.
- Motion: Tab/section geçişleri hızlı CSS transition; yoğun scroll animasyonu yok.
- Responsive: Tablolar sıkışırsa okunabilir satır kartına döner.

## Tasarım Sistemi

- Palet: Off-white zemin, beyaz yüzey, charcoal metin, restrained blue ve teal aksan.
- Radius: Genel kart ve butonlarda 8px; büyük dekoratif yuvarlak kart yok.
- Tipografi: Sistem grotesk; display metinleri geniş ve kısa. Viewport'a bağlı font ölçekleme yok.
- Motion: CSS hover + landing'de az GSAP. `prefers-reduced-motion` saygılanır.
- UI prensibi: Kart içinde kart yok; modüller net section/panel olarak ayrılır.

## Image-to-Code Detay Referansları

Bu fazda ana board'a ek olarak modül bazlı büyük referanslar üretildi ve uygulama CSS'i bu referanslardan çıkarılan ortak "operational cockpit" diline göre güncellendi.

| Referans | Kullanım |
| --- | --- |
| `C:\Users\Alperen\.codex\generated_images\019e0868-542e-7932-a775-d2f7c7759050\ig_0cd9f8ba8a8f4919016a05e6fd74448191862f043a4e21ffaa.png` | Analiz ekranları: Spending DNA, kategori, what-if, emotional delay, hedefler. |
| `C:\Users\Alperen\.codex\generated_images\019e0868-542e-7932-a775-d2f7c7759050\ig_0cd9f8ba8a8f4919016a05e7613f548191a8eebe096be4f84a.png` | Agent ve aksiyon merkezi: chat, kalite sinyali, agent chain, structured proposals. |
| `C:\Users\Alperen\.codex\generated_images\019e0868-542e-7932-a775-d2f7c7759050\ig_0cd9f8ba8a8f4919016a05e7c4b4fc81918a2aa1fc281590b2.png` | Belge zekası: fiş/ekstre upload, preview, confirm, belge geçmişi. |
| `C:\Users\Alperen\.codex\generated_images\019e0868-542e-7932-a775-d2f7c7759050\ig_0cd9f8ba8a8f4919016a05e82dc05881919d505b194875c4ba.png` | Portföy: özet, fiyat veri durumu, varlık listesi, portföy ikizi. |
| `C:\Users\Alperen\.codex\generated_images\019e0868-542e-7932-a775-d2f7c7759050\ig_0cd9f8ba8a8f4919016a05e909c7208191b1602fea48f11d8b.png` | KOBİ: cashflow, coverage, collections, scenario ve records panelleri. |
