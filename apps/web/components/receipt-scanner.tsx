"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Upload } from "lucide-react";
import type { ReceiptExpenseImportResult, StatementImportResult } from "@fintwin/shared";
import { postReceiptExpenseImport, postStatementImport, postSubscriptionReminder } from "../lib/api";

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve) => {
    if (!/(text|csv|json)/i.test(file.type) && !/\.(txt|csv|json)$/i.test(file.name)) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => resolve("");
    reader.readAsText(file);
  });
}

export function ReceiptScanner() {
  const router = useRouter();
  const [receiptResult, setReceiptResult] = useState<ReceiptExpenseImportResult | null>(null);
  const [statementResult, setStatementResult] = useState<StatementImportResult | null>(null);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [statementTab, setStatementTab] = useState<"transactions" | "subscriptions">("transactions");
  const [reminderDates, setReminderDates] = useState<Record<string, string>>({});
  const [scheduledReminderId, setScheduledReminderId] = useState<string | null>(null);
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

  async function onStatementFile(file?: File) {
    setStatementLoading(true);
    setError(null);
    try {
      const [imageBase64, statementText] = file ? await Promise.all([readFileAsBase64(file), readFileAsText(file)]) : [undefined, undefined];
      const result = await postStatementImport({
        imageBase64: statementText ? undefined : imageBase64,
        statementText,
        mimeType: file?.type,
        fileName: file?.name
      });
      setStatementResult(result);
      setReminderDates(
        Object.fromEntries(result.recurringSubscriptions.map((subscription) => [subscription.id, subscription.nextEstimatedAt]))
      );
      setStatementTab(result.recurringSubscriptions.length ? "subscriptions" : "transactions");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Ekstre işlenemedi.");
    } finally {
      setStatementLoading(false);
    }
  }

  async function scheduleReminder(subscriptionId: string) {
    const subscription = statementResult?.recurringSubscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return;
    const remindAt = reminderDates[subscriptionId] ?? subscription.nextEstimatedAt;
    await postSubscriptionReminder({
      merchant: subscription.merchant,
      amount: subscription.amount,
      remindAt,
      note: `${statementResult?.statementMonth} ekstresinden tespit edildi`
    });
    setScheduledReminderId(subscriptionId);
    router.refresh();
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
      <label className="upload-zone">
        <Upload size={32} />
        <strong>{statementLoading ? "Ekstre işleniyor" : "Ay sonu ekstresini yükle"}</strong>
        <span>Statement Agent ekstredeki aylık harcama kalemlerini ayrıştırır, kategorize eder ve her birini gider olarak ekler.</span>
        <input type="file" accept="image/*,.pdf,.txt,.csv" onChange={(event) => onStatementFile(event.target.files?.[0])} />
      </label>
      {statementResult ? (
        <div className="panel receipt-result">
          <div className="section-title">
            <span>{statementResult.statementMonth} ekstresi</span>
            <strong>{statementResult.importedCount} gider eklendi</strong>
          </div>
          <div className="segmented-tabs">
            <button className={statementTab === "transactions" ? "active" : ""} onClick={() => setStatementTab("transactions")}>
              Harcama kalemleri
            </button>
            <button className={statementTab === "subscriptions" ? "active" : ""} onClick={() => setStatementTab("subscriptions")}>
              Tekrar eden abonelikler
            </button>
          </div>
          {statementTab === "transactions" ? (
            <div className="transaction-list">
              {(statementResult.transactions.length ? statementResult.transactions : statementResult.items).map((item) => (
                <div className="transaction-row" key={`${item.merchant}-${item.amount}-${item.occurredAt}`}>
                  <span>{item.merchant}</span>
                  <small>{"categoryId" in item ? item.categoryId : item.categoryName}</small>
                  <strong>{item.amount.toLocaleString("tr-TR")} TL</strong>
                </div>
              ))}
            </div>
          ) : (
            <div className="transaction-list">
              {statementResult.recurringSubscriptions.length ? (
                statementResult.recurringSubscriptions.map((subscription) => (
                  <div className="subscription-row" key={subscription.id}>
                    <div>
                      <strong>{subscription.merchant}</strong>
                      <small>
                        {subscription.amount.toLocaleString("tr-TR")} TL · {subscription.occurrenceCount} tekrar · %{Math.round(subscription.confidence * 100)} güven
                      </small>
                    </div>
                    <input
                      type="date"
                      value={reminderDates[subscription.id] ?? subscription.nextEstimatedAt}
                      onChange={(event) => setReminderDates((current) => ({ ...current, [subscription.id]: event.target.value }))}
                    />
                    <button className="secondary-button" onClick={() => scheduleReminder(subscription.id)}>
                      {scheduledReminderId === subscription.id ? "Hatırlatma kuruldu" : "Bu tarihte hatırlat"}
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-state">Tekrar eden abonelik bulunamadı.</div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
