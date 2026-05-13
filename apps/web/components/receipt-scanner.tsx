"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, FileUp } from "lucide-react";
import { receiptErrorMessage, type ReceiptExpenseImportResult } from "@fintwin/shared";
import { postReceiptExpenseImport, ReceiptApiError } from "../lib/api";
import { StatementUploader } from "./statement-uploader";

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ReceiptScanner() {
  const router = useRouter();
  const receiptCameraInputRef = useRef<HTMLInputElement | null>(null);
  const receiptFileInputRef = useRef<HTMLInputElement | null>(null);
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReceiptFile(file?: File) {
    if (!file) return;
    setReceiptLoading(true);
    setError(null);
    try {
      const base64 = file ? await readFileAsBase64(file) : undefined;
      const result = await postReceiptExpenseImport(base64, file?.type);
      setReceiptResult(result);
      router.refresh();
    } catch (caught) {
      setError(formatReceiptError(caught, "Fiş işlenemedi."));
    } finally {
      setReceiptLoading(false);
    }
  }

  return (
    <div className="receipt-grid">
      <div className="upload-zone">
        <Camera size={32} />
        <strong>{receiptLoading ? "Fiş işleniyor" : "Fişi kameradan okut ve giderlere ekle"}</strong>
        <span>Receipt Agent tutar, tarih, satıcı, KDV, kategori ve ödeme tipini çıkarır; gider transaction'ını otomatik oluşturur.</span>
        <div className="upload-actions">
          <button className="secondary-button" type="button" onClick={() => receiptCameraInputRef.current?.click()} disabled={receiptLoading}>
            <Camera size={16} />
            Kamera ile okut
          </button>
          <button className="secondary-button voice-button" type="button" onClick={() => receiptFileInputRef.current?.click()} disabled={receiptLoading}>
            <FileUp size={16} />
            Mevcut dosya yükle
          </button>
        </div>
        <input
          ref={receiptCameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(event) => {
            void onReceiptFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
        <input
          ref={receiptFileInputRef}
          type="file"
          accept="image/*"
          onChange={(event) => {
            void onReceiptFile(event.target.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </div>
      {error ? <p className="form-message">{error}</p> : null}
      {receiptResult ? (
        <div className="panel receipt-result">
          <div className="section-title">
            <span>{receiptResult.receipt.merchant}</span>
            <strong>{receiptResult.transaction.amount.toLocaleString("tr-TR")} TL gider eklendi</strong>
          </div>
          <dl className="facts">
            <div>
              <dt>Tarih</dt>
              <dd>{receiptResult.receipt.occurredAt}</dd>
            </div>
            <div>
              <dt>KDV</dt>
              <dd>{receiptResult.receipt.taxAmount.toLocaleString("tr-TR")} TL</dd>
            </div>
            <div>
              <dt>Kategori</dt>
              <dd>{receiptResult.receipt.categoryName}</dd>
            </div>
            <div>
              <dt>Güven</dt>
              <dd>{Math.round(receiptResult.receipt.confidence * 100)}%</dd>
            </div>
          </dl>
        </div>
      ) : null}
      <StatementUploader />
    </div>
  );
}

function formatReceiptError(error: unknown, fallback: string): string {
  if (error instanceof ReceiptApiError) {
    return receiptErrorMessage(error.code, error.message);
  }
  return error instanceof Error ? error.message : fallback;
}
