"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import type { ReceiptExpenseImportResult } from "@fintwin/shared";
import { postReceiptExpenseImport } from "../lib/api";
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
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onReceiptFile(file?: File) {
    setReceiptLoading(true);
    setError(null);
    try {
      const base64 = file ? await readFileAsBase64(file) : undefined;
      const result = await postReceiptExpenseImport(base64, file?.type, file?.name);
      setReceiptResult(result);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Fiş işlenemedi.");
    } finally {
      setReceiptLoading(false);
    }
  }

  return (
    <div className="receipt-grid">
      <label className="upload-zone">
        <Camera size={32} />
        <strong>{receiptLoading ? "Fiş işleniyor" : "Fişi kameradan okut ve giderlere ekle"}</strong>
        <span>Receipt Agent tutar, tarih, satıcı, KDV, kategori ve ödeme tipini çıkarır; gider transaction'ını otomatik oluşturur.</span>
        <input type="file" accept="image/*" capture="environment" onChange={(event) => onReceiptFile(event.target.files?.[0])} />
      </label>
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
