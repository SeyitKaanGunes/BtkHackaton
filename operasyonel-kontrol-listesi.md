# Operasyonel Kontrol Listesi

Bu dosya repodaki mevcut durumu prod/dev operasyonu açısından not eder. Amaç mock doldurmak değil; canlıya çıkarken hangi ayarların netleştirilmesi gerektiğini görünür yapmak.

## Mevcut Güçlü Taraflar

- `.env.example` ve `.env.production.example` ayrılmış.
- API `NODE_ENV=production` için `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `QWEN_API_KEY`, `TWELVE_DATA_API_KEY`, Google OAuth, OpenAI STT ve Gemini TTS anahtarlarını doğruluyor.
- Placeholder prod secret değerleri reddediliyor.
- API Supabase/Postgres bağlantısı hazır değilse fail-fast davranıyor.
- Web oturum tokenını `localStorage` yerine HttpOnly `fintwin_token` cookie ile tutuyor.
- Browser istekleri `/api/backend/*` proxy'sinden geçip cookie'yi server-side authorization header'a çeviriyor.
- `npm run dev:local` API ve web'i birlikte kaldırıyor, port çakışmalarını temizliyor.
- `check:no-env` script'i staged gerçek `.env` dosyalarını commit etmeyi engellemek için hazır.
- Portfolio fiyatı yoksa fake P/L üretmeme çizgisi korunuyor.

## P0 - Canlıya Çıkmadan Önce Netleşmesi Gerekenler

### 1. Deploy hedefi ve build komutları

Repo içinde Vercel/Render/Railway/Fly config veya Dockerfile yok. Web ve API'nin nerede çalışacağı seçilip net build/start komutları yazılmalı.

Öneri:
- Web için deploy hedefi: Vercel veya benzeri Next.js host.
- API için deploy hedefi: Render/Railway/Fly/VM gibi uzun çalışan Node servisi.
- API build: `npm run build -w @fintwin/api`
- API start: `npm run start -w @fintwin/api`
- Web build: `npm run build -w @fintwin/web`
- Web start hedef platforma göre dokümante edilmeli.

### 2. CI pipeline yok

Repo kökünde `.github/workflows` yok. Şu anda push/PR öncesi test ve typecheck elle çalışıyor.

Öneri minimum CI:
- `npm ci`
- `npm run check:no-env`
- `npm run build -w @fintwin/shared`
- `npm run typecheck --workspaces --if-present`
- `npm run test --workspaces --if-present`

Not: API test script'i `prisma generate` çalıştırdığı için Windows'ta API dev server açıksa Prisma engine DLL kilidi oluşabiliyor. CI Linux'ta bu daha az sorun çıkarır; lokal için "API kapalıyken full test" kuralı dokümante edilmeli.

### 3. Prod DB migration akışı

README şu an prod öncesi `npm run db:push` diyor. Hackathon için pratik ama prod operasyonunda kalıcı migration geçmişi daha doğru olur.

Öneri:
- `apps/api/prisma/migrations` kullanıma alınsın.
- Geliştirme: `prisma migrate dev`
- Prod: `prisma migrate deploy`
- `db:push` sadece bilinçli schema sync/dev aracı olarak kalsın.

### 4. Health/readiness endpoint eksik

API'de public `GET /health` veya `GET /ready` endpoint'i yok. `dev-local` readiness için `/auth/me` 401 cevabını kullanıyor; bu prod load balancer veya uptime monitor için ideal değil.

Öneri:
- `GET /health`: process çalışıyor mu.
- `GET /ready`: Prisma bağlantısı, DataStore hydrate durumu, kritik env durumu.
- DB erişemiyorsa `/ready` 503 dönsün.

### 5. Rate limit ve brute-force koruması yok

Auth, agent, OCR, speech ve document upload endpointleri canlı maliyet ve kötüye kullanım riski taşıyor. Kodda Nest throttler/rate-limit katmanı görünmüyor.

Öneri:
- `/auth/login`, `/auth/register`, `/auth/google` için IP + email bazlı sıkı limit.
- `/documents/*`, `/agent/chat`, `/speech/*` için kullanıcı bazlı kota.
- Qwen/OpenAI/Gemini hata/kota durumları için 429/503 ayrımı.

### 6. Security headers / Helmet yok

API tarafında `helmet` veya benzeri güvenlik header middleware'i görünmüyor.

Öneri:
- API'de Helmet eklenmeli.
- CORS zaten explicit origin istiyor; prod domain listesi ayrı kontrol edilmeli.
- Web için CSP ayrıca değerlendirilmeli; Google OAuth ve API domainleri bu CSP'ye eklenmeli.

## P1 - Dış Servis ve Ürün Operasyonu

### 1. Google OAuth prod ayarları

Kod web-only Google OAuth akışına uygun. Prod için Google Cloud Console tarafında uygulama adı, logo, support email, authorized JavaScript origin ve redirect URI gerçek domainle eşleşmeli.

Kontrol listesi:
- `GOOGLE_OAUTH_CLIENT_ID` API'de.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` web'de.
- Authorized origin: `https://web-domain`
- Redirect URI: `https://web-domain/login/google`
- Consent screen uygulama adı artık eski LMS adı olmamalı.

### 2. Qwen/Gemini/OpenAI kota ve model erişimi

Env validation anahtarları zorluyor ama sağlayıcı tarafındaki model erişimi/kota runtime'da anlaşılır. Özellikle TTS tarafında model erişimi daha önce sorun çıkardı.

Öneri:
- Deploy öncesi smoke script:
  - Qwen text chat
  - Qwen vision OCR küçük görsel
  - Gemini TTS kısa metin
  - OpenAI STT küçük audio
- Başarısız servis için UI'da "özellik kapalı" durumu korunmalı.

### 3. Twelve Data kota takibi

Quote cache var ve fake fiyat üretilmiyor. Yine de provider quota/429 durumları ayrı izlenmeli.

Öneri:
- Twelve Data response status/message loglanırken secret sızdırılmasın.
- Provider 429 ise kullanıcıya "piyasa verisi kotası doldu" benzeri açık durum gösterilsin.
- Quote cache TTL prod değerinin ürün beklentisiyle uyumu kontrol edilsin.

### 4. FCM gerçek bildirim gönderimi yok

Repo FCM token kaydediyor ancak gerçek push notification sender/job akışı görünmüyor. README de bunu placeholder olarak söylüyor.

Öneri:
- Bildirim gerçekten üründe olacaksa Firebase Admin credential, sender service ve reminder job eklenmeli.
- Olmayacaksa mobil/web UI'daki bildirim beklentisi düşük tutulmalı.

### 5. Background job / scheduler yok

Subscription reminder action'ı DB'ye pending action olarak düşüyor; otomatik saatinde push/email gönderimi için scheduler görünmüyor.

Öneri:
- Cron/worker veya platform scheduled job tasarlansın.
- Due action tarama, retry, idempotency ve delivery status alanları eklenmeli.

## P1 - Veri ve Güvenlik Operasyonu

### 1. Supabase backup ve region kararı

Supabase bağlantısı çalışıyor. Bölge Asya Pasifik ise Türkiye kullanıcıları için ekstra latency yaratabilir; kritik değil ama prod öncesi bilinçli karar olmalı.

Kontrol:
- Free tier backup/restore beklentisi net mi?
- Bölge sonradan taşınacaksa migration planı var mı?
- Connection pooler URI prod runtime'da, direct/session URI migration'da kullanılıyor mu?

### 2. Veri silme / export / retention yok

Finansal veri tutulduğu için kullanıcı veri silme ve dışa aktarma ihtiyacı ürünleşirse önemli olur.

Öneri:
- Hesap silme endpointi.
- Kullanıcıya ait transaction/document/action/subscription/business kayıtlarını temizleyen tek transaction.
- JSON/CSV export endpointi.
- Belge rawResult ve hash retention politikası.

### 3. Loglarda PII kontrolü

API'de genel olarak secret loglanmıyor. Ancak ekstre chunk işlemede `console.log` var; doğrudan satır içeriği basmıyor ama prod logging standardına taşınmalı.

Öneri:
- `console.log` yerine Nest `Logger`.
- Request id / user id hash / endpoint / duration / status logları.
- Belge, merchant, email, token, base64 içerik loglanmamalı.

### 4. Upload boyutu ve maliyet kontrolü

API JSON body limiti 20 MB. Fiş/ekstre base64 gönderildiği için bu maliyet ve latency yaratabilir.

Öneri:
- Dosya tipi ve boyut validasyonu endpoint seviyesinde açık olmalı.
- PDF sayfa limiti kullanıcıya net dönmeli.
- Uzun vadede object storage + signed upload değerlendirilmeli.

## P1 - Mobil Operasyon

### 1. Production API URL zorunluluğu

Mobilde prod runtime için `EXPO_PUBLIC_API_URL` zorunlu. Build ortamında bu değer kesin set edilmeli.

Kontrol:
- iOS/Android release build env dokümante edilmeli.
- Lokal Android emulator için `10.0.2.2` infer logic var; release bunu kullanmamalı.

### 2. Mobil izinler sadeleştirilmeli

Android manifest location izinleri içeriyor; iOS `NSLocationWhenInUseUsageDescription` boş. Üründe konum kullanılmıyorsa izinler kaldırılmalı.

Öneri:
- Kullanılmayan location izinlerini temizle.
- Mikrofon, kamera, photo library açıklamaları store review için net kalsın.

### 3. Store/release ayarları

React Native app var ama release signing, bundle id/application id, versioning ve store metadata operasyonu dokümante değil.

Öneri:
- iOS bundle id ve provisioning.
- Android applicationId, signing config, versionCode/versionName.
- Release build komutları.

## P2 - Geliştirici Deneyimi ve Runbook

### 1. Tek komutlu smoke test

Elle testler iyi ama tekrar edilebilir smoke script yok.

Öneri:
- `npm run smoke:api`: register/login, dashboard, transaction create, statement preview/confirm küçük fixture.
- `npm run smoke:web`: login sayfası ve ana sayfa server render kontrolü.
- Smoke test gerçek prod DB'yi kirletmemeli; test user cleanup içermeli.

### 2. Operasyon runbook

README iyi ama hata çözüm runbook'u ayrı olabilir.

Öneri başlıkları:
- Supabase bağlantısı koparsa ne yapılır.
- Prisma DLL lock lokal hatası nasıl çözülür.
- Google OAuth redirect mismatch nasıl çözülür.
- Qwen/Gemini/OpenAI 401/403/429 durumları.
- Twelve Data kota dolarsa kullanıcıya ne söylenir.

### 3. Secret commit koruması hook'a bağlanmalı

`check:no-env` script'i var ama otomatik git hook veya CI yoksa unutulabilir.

Öneri:
- CI içine ekle.
- İstersen lokal pre-commit hook veya Husky benzeri yapı ekle.

### 4. Eski log dosyaları ve dev artefaktları

Repo kökünde `api-dev.out.log`, `web-dev.err.log`, `.codex-dev.log` gibi log dosyaları duruyor. Bunlar operasyonel dokümana gerekmez ve repo gürültüsü yaratır.

Öneri:
- `.gitignore` logları kapsıyor mu kontrol et.
- Commit'e girmişse temizle.
- Runtime logları platform logging'e gitsin.

## Önerilen Sıra

1. CI pipeline ekle.
2. Health/readiness endpoint ekle.
3. Prod DB migration akışını `migrate deploy` çizgisine taşı.
4. Rate limit + Helmet ekle.
5. Google OAuth prod domain/consent ayarlarını tamamla.
6. Qwen/Gemini/OpenAI/Twelve Data smoke scriptlerini yaz.
7. FCM/reminder job ürün kararını netleştir.
8. Mobil izinleri sadeleştir.
9. Backup/restore ve veri silme/export runbook'unu yaz.
