export const STATEMENT_ERROR_MESSAGES: Record<string, string> = {
  STATEMENT_TEXT_EXTRACTION_FAILED: "PDF metni okunamadı. Dosya bozuk olabilir, lütfen başka bir PDF deneyin.",
  STATEMENT_OCR_FAILED: "Taranmış PDF için OCR şu an aktif değil. Daha net bir PDF veya görsel yükleyin.",
  STATEMENT_JSON_PARSE_FAILED: "Ekstre yapay zeka yanıtı ayrıştırılamadı. Lütfen tekrar deneyin.",
  STATEMENT_NO_VALID_ITEMS: "Ekstrede içe aktarılabilecek harcama kalemi bulunamadı.",
  STATEMENT_FILE_TOO_LARGE: "Dosya çok büyük (en fazla 20MB).",
  STATEMENT_UNSUPPORTED_FILE_TYPE: "Desteklenmeyen dosya tipi. PDF veya görsel yükleyin."
};

export function statementErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return STATEMENT_ERROR_MESSAGES[code] ?? fallback;
}
