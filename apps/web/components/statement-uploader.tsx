"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RotateCcw, Upload } from "lucide-react";
import { statementErrorMessage, type StatementConfirmResult, type StatementPreviewResult } from "@fintwin/shared";
import { postStatementConfirm, postStatementPreview, postSubscriptionReminder, StatementApiError } from "../lib/api";

type UploaderState =
  | { phase: "idle" }
  | { phase: "uploading" }
  | { phase: "preview"; data: StatementPreviewResult; selected: Set<number>; skipDuplicates: boolean }
  | { phase: "confirming" }
  | { phase: "confirmed"; data: StatementConfirmResult }
  | { phase: "error"; message: string; code?: string };

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function inferMimeType(file: File) {
  if (file.type) return file.type;
  return file.name.toLocaleLowerCase("tr-TR").endsWith(".pdf") ? "application/pdf" : "application/octet-stream";
}

export function StatementUploader() {
  const router = useRouter();
  const [state, setState] = useState<UploaderState>({ phase: "idle" });
  const [statementTab, setStatementTab] = useState<"transactions" | "subscriptions">("transactions");
  const [reminderDates, setReminderDates] = useState<Record<string, string>>({});
  const [scheduledReminderId, setScheduledReminderId] = useState<string | null>(null);

  async function onStatementFile(file?: File) {
    if (!file) return;
    setState({ phase: "uploading" });
    setScheduledReminderId(null);
    try {
      const fileBase64 = await readFileAsBase64(file);
      const data = await postStatementPreview({
        fileBase64,
        mimeType: inferMimeType(file),
        fileName: file.name
      });
      const selected = new Set(data.items.filter((item) => !item.existingTransactionId).map((item) => item.index));
      setStatementTab("transactions");
      setState({ phase: "preview", data, selected, skipDuplicates: true });
    } catch (error) {
      setState(toErrorState(error, "Ekstre işlenemedi."));
    }
  }

  function toggleItem(index: number) {
    if (state.phase !== "preview") return;
    const selected = new Set(state.selected);
    if (selected.has(index)) {
      selected.delete(index);
    } else {
      selected.add(index);
    }
    setState({ ...state, selected });
  }

  async function confirmImport() {
    if (state.phase !== "preview") return;
    const { data, selected, skipDuplicates } = state;
    setState({ phase: "confirming" });
    try {
      const confirmed = await postStatementConfirm({
        documentId: data.documentId,
        selectedItemIndexes: [...selected],
        skipDuplicates
      });
      setReminderDates(Object.fromEntries(confirmed.recurringSubscriptions.map((subscription) => [subscription.id, subscription.nextEstimatedAt])));
      setStatementTab(confirmed.recurringSubscriptions.length ? "subscriptions" : "transactions");
      setState({ phase: "confirmed", data: confirmed });
      router.refresh();
    } catch (error) {
      setState(toErrorState(error, "Ekstre içe aktarılamadı."));
    }
  }

  async function scheduleReminder(subscriptionId: string) {
    if (state.phase !== "confirmed") return;
    const subscription = state.data.recurringSubscriptions.find((item) => item.id === subscriptionId);
    if (!subscription) return;
    const remindAt = reminderDates[subscriptionId] ?? subscription.nextEstimatedAt;
    await postSubscriptionReminder({
      merchant: subscription.merchant,
      amount: subscription.amount,
      remindAt,
      note: `${state.data.statementMonth} ekstresinden tespit edildi`
    });
    setScheduledReminderId(subscriptionId);
    router.refresh();
  }

  if (state.phase === "preview") {
    return (
      <div className="panel receipt-result statement-preview">
        <div className="section-title">
          <span>{state.data.statementMonth} ekstresi</span>
          <strong>{state.data.items.length} kalem bulundu</strong>
        </div>
        <div className="statement-summary">
          <div>
            <span>Toplam</span>
            <strong>{state.data.totalAmount.toLocaleString("tr-TR")} TL</strong>
          </div>
          <div>
            <span>Ortalama güven</span>
            <strong>%{Math.round(state.data.avgConfidence * 100)}</strong>
          </div>
          <div>
            <span>Yinelenen</span>
            <strong>{state.data.duplicateCount}</strong>
          </div>
        </div>
        {state.data.warnings.length ? (
          <div className="statement-warning">
            <AlertTriangle size={16} />
            <ul>
              {state.data.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="statement-actions">
          <button
            className="secondary-button"
            onClick={() => setState({ ...state, selected: new Set(state.data.items.map((item) => item.index)) })}
          >
            Tümünü seç
          </button>
          <button className="secondary-button" onClick={() => setState({ ...state, selected: new Set() })}>
            Hiçbirini seçme
          </button>
          <label className="statement-toggle">
            <input
              type="checkbox"
              checked={state.skipDuplicates}
              onChange={(event) => setState({ ...state, skipDuplicates: event.target.checked })}
            />
            Yinelenenleri atla
          </label>
        </div>
        <div className="statement-table">
          <div className="statement-table-head">
            <span />
            <span>Tarih</span>
            <span>Satıcı</span>
            <span>Kategori</span>
            <span>Tutar</span>
            <span>Güven</span>
          </div>
          {state.data.items.map((item) => (
            <label className={`statement-table-row ${item.confidence < 0.6 ? "low-confidence" : ""}`} key={item.index}>
              <input type="checkbox" checked={state.selected.has(item.index)} onChange={() => toggleItem(item.index)} />
              <span>{item.occurredAt}</span>
              <span>
                <strong>{item.merchant}</strong>
                {item.existingTransactionId ? <small className="statement-badge">Mevcut kayıtla eşleşiyor</small> : null}
              </span>
              <span>{item.categoryName}</span>
              <strong>{item.amount.toLocaleString("tr-TR")} TL</strong>
              <span>%{Math.round(item.confidence * 100)}</span>
            </label>
          ))}
        </div>
        <button className="secondary-button statement-confirm" disabled={!state.selected.size} onClick={confirmImport}>
          Onayla ve içe aktar
        </button>
      </div>
    );
  }

  if (state.phase === "confirming") {
    return (
      <div className="upload-zone statement-upload-zone">
        <Upload size={32} />
        <strong>Ekstre içe aktarılıyor</strong>
      </div>
    );
  }

  if (state.phase === "confirmed") {
    return (
      <div className="panel receipt-result">
        <div className="section-title">
          <span>{state.data.statementMonth} ekstresi</span>
          <strong>{state.data.importedCount} gider eklendi</strong>
        </div>
        <div className="statement-summary">
          <div>
            <span>İçe aktarılan</span>
            <strong>{state.data.importedCount}</strong>
          </div>
          <div>
            <span>Atlanan</span>
            <strong>{state.data.skippedCount}</strong>
          </div>
          <div>
            <span>Yinelenen</span>
            <strong>{state.data.duplicateCount}</strong>
          </div>
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
            {state.data.transactions.map((transaction) => (
              <div className="transaction-row" key={transaction.id}>
                <span>{transaction.merchant}</span>
                <small>{transaction.categoryId}</small>
                <strong>{transaction.amount.toLocaleString("tr-TR")} TL</strong>
              </div>
            ))}
          </div>
        ) : (
          <div className="transaction-list">
            {state.data.recurringSubscriptions.length ? (
              state.data.recurringSubscriptions.map((subscription) => (
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
        <button className="secondary-button" onClick={() => setState({ phase: "idle" })}>
          Yeni ekstre yükle
        </button>
      </div>
    );
  }

  if (state.phase === "error") {
    return (
      <div className="panel statement-error">
        <AlertTriangle size={20} />
        <strong>{state.message}</strong>
        {state.code ? <small>{state.code}</small> : null}
        <button className="secondary-button" onClick={() => setState({ phase: "idle" })}>
          <RotateCcw size={14} />
          Tekrar dene
        </button>
      </div>
    );
  }

  return (
    <label className="upload-zone statement-upload-zone">
      {state.phase === "uploading" ? <CheckCircle2 size={32} /> : <Upload size={32} />}
      <strong>{state.phase === "uploading" ? "Ekstre önizlemesi hazırlanıyor" : "Ay sonu ekstresini yükle"}</strong>
      <span>PDF veya görsel ekstreyi yükle; kalemleri kontrol edip seçtiklerini giderlere aktar.</span>
      <input type="file" accept="image/*,.pdf" onChange={(event) => onStatementFile(event.target.files?.[0])} />
    </label>
  );
}

function toErrorState(error: unknown, fallback: string): UploaderState {
  if (error instanceof StatementApiError) {
    return { phase: "error", message: statementErrorMessage(error.code, error.message), code: error.code };
  }
  return { phase: "error", message: error instanceof Error ? error.message : fallback };
}
