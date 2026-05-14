import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileText } from "lucide-react";
import { AppShell } from "../../../components/app-shell";
import { getDocumentDetail } from "../../../lib/api";
import { requirePersonalSession } from "../../../lib/server-auth";

export const dynamic = "force-dynamic";

type DocumentDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const { token, user } = await requirePersonalSession();
  const { id } = await params;
  const document = await getDocumentDetail(id, { token });

  return (
    <AppShell active="/" accountType={user.accountType}>
      <header className="workspace-header">
        <div>
          <Link className="text-link back-link" href="/">
            <ArrowLeft size={16} />
            Özete dön
          </Link>
          <p className="eyebrow">Belge geçmişi</p>
          <h1>
            <FileText size={30} />
            {document.fileName ?? document.merchant ?? document.statementMonth ?? "Belge detayı"}
          </h1>
          <p className="header-subtitle">Çıkarılan kalemler, uyarılar, düşük güven sinyalleri ve import durumu.</p>
        </div>
      </header>

      <section className="metric-grid">
        <DocumentMetric label="Durum" value={document.status} />
        <DocumentMetric label="Toplam" value={document.totalAmount !== undefined ? `${document.totalAmount.toLocaleString("tr-TR")} TL` : "-"} />
        <DocumentMetric label="Kalem" value={`${document.itemCount}`} />
        <DocumentMetric label="Düşük güven" value={`${document.lowConfidenceCount}`} />
      </section>

      {document.warnings.length ? (
        <section className="panel document-warning-panel">
          <div className="section-title">
            <span>Uyarılar</span>
            <strong>{document.warnings.length}</strong>
          </div>
          <ul className="reason-list">
            {document.warnings.map((warning) => (
              <li key={warning}>
                <AlertTriangle size={15} />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel detail-panel">
        <div className="section-title">
          <span>Çıkarılan kalemler</span>
          <strong>{document.items.length}</strong>
        </div>
        {document.items.length ? (
          <div className="document-detail-list">
            {document.items.map((item, index) => (
              <article className="document-detail-row" key={`${item.label}-${index}`}>
                <div>
                  <strong>{item.merchant ?? item.label}</strong>
                  <span>
                    {[item.occurredAt, item.categoryName, item.paymentMethod].filter(Boolean).join(" · ") || "Detay yok"}
                  </span>
                </div>
                <div>
                  <strong>{item.amount !== undefined ? `${item.amount.toLocaleString("tr-TR")} TL` : "-"}</strong>
                  {item.confidence !== undefined ? <span>%{Math.round(item.confidence * 100)} güven</span> : null}
                  {item.duplicate ? <span>mükerrer işaretli</span> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">Bu belge için kalem detayı kaydedilmemiş.</div>
        )}
      </section>

      <section className="panel document-status-panel">
        <div className="document-status-item">
          <CheckCircle2 size={18} />
          <span>Import</span>
          <strong>{document.importedAt ? new Date(document.importedAt).toLocaleString("tr-TR") : "Henüz import edilmedi"}</strong>
        </div>
        <div className="document-status-item">
          <FileText size={18} />
          <span>Kaynak</span>
          <strong>{document.sourceType ?? document.kind}</strong>
        </div>
      </section>
    </AppShell>
  );
}

function DocumentMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric accent">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
