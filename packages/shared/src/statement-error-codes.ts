export const STATEMENT_ERROR_MESSAGES: Record<string, string> = {
  STATEMENT_AI_NOT_CONFIGURED: "Ekstre analizi için QWEN_API_KEY tanımlı değil. Demo sonuç üretilmedi; lütfen API yapılandırmasını tamamlayın.",
  STATEMENT_TEXT_EXTRACTION_FAILED: "PDF metni okunamadı. Dosya bozuk olabilir, lütfen başka bir PDF deneyin.",
  STATEMENT_OCR_FAILED: "Taranmış PDF görsele çevrilemedi. Daha net bir PDF veya görsel yükleyin.",
  STATEMENT_PDF_VISION_PAGE_LIMIT: "Taranmış PDF vision OCR için çok uzun. En fazla 3 sayfalık ekstre yükleyin.",
  STATEMENT_PDF_RENDER_FAILED: "Taranmış PDF sayfaları görsele çevrilemedi.",
  STATEMENT_JSON_PARSE_FAILED: "Ekstre yapay zeka yanıtı ayrıştırılamadı. Lütfen tekrar deneyin.",
  STATEMENT_NO_VALID_ITEMS: "Ekstrede içe aktarılabilecek harcama kalemi bulunamadı.",
  STATEMENT_FILE_TOO_LARGE: "Dosya çok büyük (en fazla 20MB).",
  STATEMENT_UNSUPPORTED_FILE_TYPE: "Desteklenmeyen dosya tipi. PDF veya görsel yükleyin."
};

export function statementErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return STATEMENT_ERROR_MESSAGES[code] ?? fallback;
}

export const RECEIPT_ERROR_MESSAGES: Record<string, string> = {
  RECEIPT_AI_NOT_CONFIGURED: "Fiş analizi için QWEN_API_KEY tanımlı değil. Demo sonuç üretilmedi; lütfen API yapılandırmasını tamamlayın.",
  RECEIPT_JSON_PARSE_FAILED: "Fiş yapay zeka yanıtı ayrıştırılamadı. Lütfen daha net bir görsel ile tekrar deneyin.",
  RECEIPT_INVALID_AMOUNT: "Fiş tutarı okunamadı. İşlem DB'ye yazılmadı.",
  RECEIPT_INVALID_DATE: "Fiş tarihi okunamadı veya geçersiz. İşlem bugüne çekilmeden reddedildi.",
  RECEIPT_INVALID_MERCHANT: "Fiş satıcısı okunamadı. İşlem DB'ye yazılmadı."
};

export function receiptErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return RECEIPT_ERROR_MESSAGES[code] ?? fallback;
}
