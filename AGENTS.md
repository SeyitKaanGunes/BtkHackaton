# Project Instructions

Bu proje finansal dijital ikiz / finans asistanı projesidir.

## Genel kurallar

- Finansal hesaplamalar deterministik olmalı.
- LLM veya agent katmanı finansal sonucu uydurmamalı.
- Veri yoksa varsayım yapılmamalı; assumptions ve missingData alanları kullanılmalı.
- Mevcut API contract'ı mümkün olduğunca kırılmamalı.
- Yeni alanlar additive şekilde eklenmeli.
- Türkçe kullanıcı mesajlarına Türkçe cevap üretilmeli.
- Para birimi belirtilmemişse TRY default olabilir ama assumption olarak belirtilmeli.
- Türkiye kullanıcıları için default timezone Europe/Istanbul olmalı.
- Ham transaction verisi gereksiz yere dış servislere gönderilmemeli.

## Kodlama kuralları

- TypeScript tiplerini açık yaz.
- Parser, resolver, simulation ve explanation logic ayrı helper/service katmanlarına bölünsün.
- Büyük fonksiyonlar küçük test edilebilir fonksiyonlara ayrılmalı.
- Magic number kullanılıyorsa sebebi constant adıyla açıklanmalı.
- Hard-coded risk skorları azaltılmalı; mümkünse geçmiş veri, bütçe, cashflow ve confidence kullanılmalı.

## Test kuralları

- Her yeni davranış için test ekle.
- Mevcut testleri bozma.
- package.json içindeki resmi test komutunu kullan.
- Parser testleri gerçek Türkçe kullanıcı mesajlarını kapsamalı.
- Timezone testlerinde Europe/Istanbul kullanılmalı.
- What-if testlerinde veri yoksa varsayım uydurulmadığı doğrulanmalı.

## Finansal ürün dili

- Kullanıcıya kesin yatırım/finans tavsiyesi veriliyormuş gibi yazma.
- Cevaplar karar destek formatında olsun.
- Her simülasyonda:
  - sonuç
  - neden
  - varsayımlar
  - veri güveni
  - önerilen aksiyon
  gösterilmeli.
