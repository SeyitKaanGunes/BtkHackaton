"use client";

import { useState } from "react";
import { Camera, FileScan, Loader2 } from "lucide-react";
import type { ReceiptScanResult } from "@finshadow/shared";
import { postReceiptScan } from "../lib/api";

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ReceiptScanner() {
  const [scan, setScan] = useState<ReceiptScanResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(file?: File) {
    setLoading(true);
    const base64 = file ? await readFileAsBase64(file) : undefined;
    const result = await postReceiptScan(base64, file?.type);
    setScan(result);
    setLoading(false);
  }

  return (
    <div className="receipt-grid">
      <label className="upload-zone">
        <Camera size={32} />
        <strong>Fiş veya fatura görseli seç</strong>
        <span>Qwen OCR akışı tutar, tarih, satıcı, KDV, kategori ve ödeme tipini çıkarır.</span>
        <input type="file" accept="image/*" onChange={(event) => onFile(event.target.files?.[0])} />
      </label>
      <button className="secondary-button" onClick={() => onFile()} disabled={loading}>
        {loading ? <Loader2 size={18} className="spin" /> : <FileScan size={18} />}
        Demo OCR sonucu üret
      </button>
      {scan ? (
        <div className="panel receipt-result">
          <div className="section-title">
            <span>{scan.merchant}</span>
            <strong>{scan.totalAmount.toLocaleString("tr-TR")} TL</strong>
          </div>
          <dl className="facts">
            <div>
              <dt>Tarih</dt>
              <dd>{scan.occurredAt}</dd>
            </div>
            <div>
              <dt>KDV</dt>
              <dd>{scan.taxAmount.toLocaleString("tr-TR")} TL</dd>
            </div>
            <div>
              <dt>Kategori</dt>
              <dd>{scan.categoryName}</dd>
            </div>
            <div>
              <dt>Güven</dt>
              <dd>{Math.round(scan.confidence * 100)}%</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
