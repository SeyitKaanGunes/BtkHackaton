# Fintwin Web Ozellikleri

Bu dosya web uygulamasinin mevcut halindeki kullaniciya acik ekranlari, tiklanabilir bilesenleri ve temel isleyislerini ozetler. Tarayicida `http://localhost:3000` uzerinden login, dashboard, analiz, portfoy, agent, KOBI ve belge ekranlari gezilerek hazirlandi.

## Ortak Uygulama Iskeleti

| Bilesen | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| Sol navigasyon | Ozet, Kategori Dagilimi, Spending DNA, What-if, Emotional Delay, Aksiyon Merkezi, Abonelik Avcisi, Portfoy, Agent ve KOBI ekranlarina gecer. | `AppShell` tum korumali sayfalari sarar. Her link ilgili Next route'una gider ve aktif sayfa vurgulanir. |
| Cikis butonu | Oturumdan cikar. | Web `/api/auth/logout` route'u HttpOnly `fintwin_token` cookie'sini temizler ve kullaniciyi login ekranina dondurur. |
| Sag alttaki Ikiz butonu | Her ekrandan kompakt finansal agent panelini acar. | `AgentLauncher`, `AgentConsole` bileşenini modal olarak acarak soru sorma, mikrofon ve cevap seslendirme akisini ayni yerde sunar. |

## Oturum ve Kimlik

| Bilesen | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| Giris formu | E-posta/kullanici adi ve sifre ile giris yapar. | Web `/api/auth/login` route'u backend `/auth/login` endpointini cagirir ve JWT'yi JavaScript'ten okunamayan HttpOnly `fintwin_token` cookie'sine yazar. `admin` kullanici adi local development'ta `admin@local.dev` olarak yorumlanir; production'da bu development admin hesabiyla giris engellenir. |
| Kayit formu | Ad soyad, e-posta ve sifreyle yeni hesap acar. | Web `/api/auth/register` route'u backend `/auth/register` endpointini cagirir; kullanici DB'ye yazilir, starter hesaplari olusur ve oturum HttpOnly cookie ile baslatilir. |
| Google ile oturum ac | Google OAuth hesabi ile web oturumu acar. | Google redirect flow `id_token` uretir, `/login/google` fragment'i okur, web `/api/auth/google` route'u backend `/auth/google` ile token'i dogrular ve yerel Fintwin kullanicisina baglar veya yeni kullanici acar. |
| Korumali sayfa kontrolu | Login olmadan dashboard'a girilemez. | Server tarafinda `requireAuthSession` HttpOnly cookie token'ini okur; token yoksa `/login`, 401 varsa tekrar `/login` redirect eder. Client-side API cagrilari ayni cookie'yi kullanan `/api/backend/*` proxy'si uzerinden backend'e gider. |

## Ozet Dashboard

| Bilesen | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| Donem sekmeleri | Gunluk, haftalik, aylik veya yillik ozet gorur. | URL'deki `period` parametresiyle dashboard, kampanya ve DNA verileri secili doneme gore API'den tekrar okunur. |
| Finansal saglik karti | Saglik skoru, aksiyon ve risk ozetini gorur. | Hesaplar, islemler, hedefler, aksiyonlar ve butcelerden hesaplanan dashboard ozetini gosterir. Veri yoksa bos durum verir. |
| Metrik kartlari | Gelir, gider, bakiye ve guvenli limit degerlerini izler. | `/dashboard/personal` ve `/campaigns/readiness` verilerini formatlayarak gosterir. |
| Modül kartlari | Portfoy veya KOBI ekranina hizli gecis yapar. | Kartlar `/portfolio` ve `/business` route'larina link verir; mevcut portfoy/KOBI ozetini de gosterir. |
| Manuel islem formu | Gelir veya gider ekler; tarih, para birimi ve kategori secer. | Form `/transactions` endpointine gider. Backend kategori, tarih, tutar ve odeme yontemini dogrular; islem yazilinca ilgili hesap bakiyesi guncellenir. |
| Grafik ve analiz bloklari | Harcama dagilimi, DNA, what-if, risk, abonelik ve aksiyon ozetlerini okur. | Dashboard altinda serverdan gelen hesaplanmis sonuclar gosterilir; detayli inceleme icin ayrica kendi route'lari vardir. |

## Analiz Detay Sayfalari

| Route | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| `/categories` | Kategori bazli toplam gider, kategori sayisi, en yuksek kategori ve tasarruf oranini inceler. | Secili donem icin `categoryBreakdown` siralanir; veri yoksa fis/ekstre/manuel islem eklenmesi beklenir. |
| `/spending-dna` | Genel risk, maas gunu refleksi, gece/hafta sonu davranisi ve tasarruf disiplini skorlarini gorur. | `/spending-dna` endpointi islem gecmisinden davranissal skorlar ve eksik veri sinyalleri uretir. |
| `/what-if` | Guvenli, dengeli ve riskli harcama senaryolarini inceler. | `/simulations/what-if` finansal aktiviteye gore guvenli limit, ay sonu bakiye, borc etkisi ve tasarruf etkisi hesaplar. Veri yoksa varsayim uretmez. |
| `/emotional-delay` | Riskli harcama oncesi onerilen bekleme suresini ve gerekcelerini gorur. | What-if ve kampanya hazirlik verilerini birlestirerek bekleme dakikasi, risk seviyesi, nakit akisi ve eksik veri listesini gosterir. |
| `/actions` | Agent veya sistem tarafindan olusan aksiyonlari onaylar ya da reddeder. | `/actions` verileri listelenir. Pending aksiyonlarda `Onayla` ve `Reddet` butonlari `/actions/:id/approve` ve `/actions/:id/dismiss` endpointlerine gider. |
| `/subscriptions` | Tekrar eden, kullanilmayan veya fiyat artisi olan abonelikleri inceler. | `/subscriptions/leakage` aylik/yillik etki ve abonelik bulgularini hesaplar. Ekstre importlari arttikca daha net sonuc uretir. |

## Belge Agent'lari

| Bilesen | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| Fis yukleme (`/receipt`) | Kamera/gorsel dosya secerek fisi gider kaydina donusturur. | `ReceiptScanner`, dosyayi base64 yapip `/documents/receipt-agent/import` endpointine yollar. Qwen fis alanlarini cikarir; backend tarih, tutar, kategori, odeme yontemi ve guveni dogrular, sonra transaction olusturur. |
| Ekstre yukleme | PDF veya gorsel ekstre yukler. | `StatementUploader`, dosyayi `/documents/statement-agent/preview` ile analiz ettirir. PDF metni zayifsa vision OCR fallback kullanilabilir. |
| Ekstre onizleme | Bulunan kalemleri, toplam tutari, ortalama guveni, tekrar edenleri ve uyarilari gorur. | Onizlemede tum kalemler checkbox olarak listelenir; kullanici tek tek secebilir, tumunu secebilir, hicbirini secmeyebilir ve yinelenenleri atla ayarini degistirebilir. |
| Ekstre confirm | Secili kalemleri giderlere aktarir. | `/documents/statement-agent/confirm` sadece secili ve import edilebilir kalemleri transaction'a cevirir. Bos, tekrarli veya gecersiz secimler backend tarafinda reddedilir. |
| Abonelik hatirlatici | Ekstreden bulunan tekrar eden abonelik icin tarih secip hatirlatici kurar. | Confirm sonrasi abonelik sekmesinde `Bu tarihte hatirlat` butonu `/actions/subscription-reminder` ile aksiyon olusturur. |

## Portfoy

| Bilesen | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| Portfoy ozeti | Toplam deger, maliyet, kar/zarar, gunluk faiz, gun sonu toplam ve piyasa veri durumunu gorur. | `/investments/portfolio` holdingleri Twelve Data fiyatlari ve nakit/mevduat projeksiyonu ile hesaplar. Fiyat yoksa fake P/L uretmez, pozisyonu fiyatlanamadi olarak gosterir. |
| Sembol arama | THYAO, XAU, USD/TRY gibi semboller arar ve sonuc secer. | `searchMarketSymbols` lokal katalog, presetler ve Twelve Data sembol aramasini birlestirir. Secilen sembol asset type ve para birimini forma tasir. |
| Varlik ekleme | Hisse, altin, emtia, doviz, kripto, fon, nakit/mevduat veya diger turde pozisyon ekler. | Form `/investments/holdings` endpointine gider. Backend asset type, miktar, alis fiyati ve para birimini dogrular. Nakit/mevduat icin yillik faiz orani opsiyoneldir. |
| Pozisyon silme | Portfoydeki varligi siler. | Her pozisyon satirindaki sil butonu `/investments/holdings/:id` DELETE endpointini cagirir; kayit yoksa 404 doner. |
| Portfoyden ekstre yukleme | Portfoy ekraninda da ay sonu ekstresi yukleyebilir. | Ayni `StatementUploader` bileseni burada da calisir; secilen ekstre kalemleri giderlere aktarilir. |

## Agent

| Bilesen | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| Agent soru kutusu (`/agent`) | Finansal ikize metinle soru sorar. | `/agent/chat` LangGraph supervisor ile intent belirler; simulation, subscription, education, twin veya LLM agent yoluna gider. Cevap, guven skoru, route edilen agentlar, varsayimlar ve kanitlarla doner. |
| Konusarak gonder | Mikrofonla soru sorar. | Browser `MediaRecorder` sesi toplar, `/speech/stt` OpenAI STT ile metne cevirir, sonra ayni agent chat akisina yollar. |
| Cevabi sesli oku | Agent cevabini seslendirir. | `/speech/tts` Gemini TTS ile audio base64 uretir; browser audio olarak oynatir. |
| Onerilen aksiyonlar | Agent'in urettigi aksiyonu onaylar veya reddeder. | Agent response icindeki pending aksiyonlar ekranda listelenir; onay/red butonlari Action API'lerini kullanir ve sayfayi yeniler. |
| Kompakt agent modal | Her ekranda sag alttaki Ikiz butonuyla ayni agent konsolunu acar. | `AgentConsole` kompakt modda modal icinde kullanilir; kapatma butonu ile kapanir. |

## KOBI Modulu

| Bilesen | Kullanici ne yapar? | Nasil calisir? |
| --- | --- | --- |
| KOBI onboarding | Isletme adi, sektor ve baslangic kasa bakiyesi girer. | `/business` POST ile kullaniciya bagli ilk isletme kaydi olusturulur. Isletme yoksa `/business` sayfasi onboarding formu gosterir. |
| KOBI dashboard | Kasa, 30/60/90 gun projeksiyonu ve likidite riskini gorur. | Isletme ve nakit olaylari `calculateBusinessDashboard` ile hesaplanir. |
| Nakit olaylari | Tahsilat veya odeme kaydi ekler. | Baslik, tutar, tur ve tarih `/business/:id/cash-events` endpointine gider; dashboard projeksiyonlari yenilenir. |
| Tahsilat skorlari | Musteri ekler ve musterilerin tahsilat riskini gorur. | Musteri formu gecikme gunu, odenen/geciken fatura ve acik bakiye bilgilerini kaydeder. `calculateCollectionScore` musteri bazli skor ve oneriler uretir. |
| AI CFO simülasyonu | Yeni yatirim/odeme tutari girip KOBI karar simülasyonu calistirir. | `/business/:id/ai-cfo/simulate` tutarin 30/60/90 gun nakit etkisini, risk seviyesini, ozet ve onerilen plani hesaplar. |

## Kullaniciya Acik Veri Kaynaklari ve Kurallar

- Web, tum finansal veriyi backend API uzerinden okur; demo fallback kapali tutulur.
- Manuel islem, fis ve ekstre importlari gercek transaction yazar ve hesap bakiyesini etkiler.
- Portfoy fiyatlari Twelve Data uzerinden gelir; fiyat yoksa fake fiyatla kar/zarar hesaplanmaz.
- Qwen/Gemini/OpenAI anahtarlari frontend'e tasinmaz; sadece backend servisleri kullanir.
- KOBI verileri bireysel dashboard metriklerine karistirilmaz; ayri modulde tutulur.
