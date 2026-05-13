import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import type { DocumentHistoryItem } from "@fintwin/shared";

export function DocumentHistoryPanel({ documents }: { documents: DocumentHistoryItem[] }) {
  return (
    <section className="panel detail-panel">
      <div className="section-title">
        <span>Belge geçmişi</span>
        <strong>{documents.length}</strong>
      </div>
      {documents.length ? (
        <div className="document-history-list">
          {documents.slice(0, 8).map((document) => (
            <article className="document-history-row" key={document.id}>
              <div className="document-history-icon">{document.status === "imported" ? <CheckCircle2 size={18} /> : <FileText size={18} />}</div>
              <div>
                <strong>{documentTitle(document)}</strong>
                <span>
                  {document.kind} · {document.status} · {new Date(document.createdAt).toLocaleDateString("tr-TR")}
                </span>
                {document.warnings.length ? (
                  <small>
                    <AlertTriangle size={13} />
                    {document.warnings[0]}
                  </small>
                ) : null}
              </div>
              <div>
                <strong>{document.totalAmount !== undefined ? `${document.totalAmount.toLocaleString("tr-TR")} TL` : "-"}</strong>
                <span>{document.itemCount} kalem</span>
                {document.lowConfidenceCount ? <span>{document.lowConfidenceCount} düşük güven</span> : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">Fiş veya ekstre işlendiğinde sonuç, uyarı ve import durumu burada görünür.</div>
      )}
    </section>
  );
}

function documentTitle(document: DocumentHistoryItem) {
  return document.fileName ?? document.merchant ?? document.statementMonth ?? "Belge";
}
