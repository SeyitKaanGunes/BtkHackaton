import { AlertTriangle, Bell, FileText, Plus, Upload, X } from "lucide-react";
import { AppShell } from "../../components/app-shell";
import { DocumentHistoryPanel } from "../../components/document-history";
import { ReceiptScanner } from "../../components/receipt-scanner";
import { getDocumentHistory } from "../../lib/api";
import { requirePersonalSession } from "../../lib/server-auth";

export default async function ReceiptPage() {
  const { token, user } = await requirePersonalSession();
  const documents = await getDocumentHistory({ token });
  const selectedDocument = documents[0];
  return (
    <AppShell active="/receipt" accountType="personal" displayName={user.name}>
      <section className="image-page documents-image-page">
        <header className="image-page-header">
          <div>
            <h1>Belgeler</h1>
            <p>Fiş, ekstre ve belge zeka asistanı.</p>
          </div>
          <a className="primary-button-like" href="#document-upload">
            <Upload size={16} />
            Yeni Belge Yükle
          </a>
        </header>
        <section className="documents-reference-layout" id="document-upload">
          <main className="documents-reference-main">
            <ReceiptScanner />
            <section className="panel statement-table-preview">
              <div className="section-title">
                <span>Ekstre Önizleme</span>
                <strong>10 seçili</strong>
              </div>
              <div className="document-table">
                {[
                  ["12 May 2026", "Migros Sanal Market", "Market", "-₺652,40", "0.96"],
                  ["11 May 2026", "Netflix.com", "Eğlence", "-₺229,99", "0.93"],
                  ["10 May 2026", "Shell Akaryakıt", "Ulaşım", "-₺1.250,00", "0.91"],
                  ["09 May 2026", "Trendyol", "Alışveriş", "-₺789,90", "0.88"],
                  ["08 May 2026", "Spotify", "Eğlence", "-₺59,99", "0.90"]
                ].map((row) => (
                  <div className="document-table-row" key={row.join("-")}>
                    <input checked readOnly type="checkbox" />
                    {row.map((cell) => <span key={cell}>{cell}</span>)}
                  </div>
                ))}
              </div>
              <div className="document-import-row">
                <div>
                  <AlertTriangle size={18} />
                  <span>2 olası mükerrer işlem tespit edildi.</span>
                </div>
                <div className="success-box">Toplam kontrolü uyumlu.</div>
                <a className="primary-button-like" href="/receipt">Seçilenleri Giderlere Ekle</a>
              </div>
            </section>
            <div className="documents-bottom-grid">
              <DocumentHistoryPanel documents={documents} />
              <section className="panel imported-summary-card">
                <div className="section-title">
                  <span>İçe Aktarılan İşlemler</span>
                  <strong>Son 30 gün</strong>
                </div>
                <div className="image-impact-grid">
                  <ImpactLite label="Toplam İşlem" value="48" />
                  <ImpactLite label="Toplam Harcama" value="-₺18.452,30" />
                  <ImpactLite label="Toplam Gelir" value="+₺12.840,00" positive />
                </div>
              </section>
            </div>
          </main>
          <aside className="documents-sidecar panel">
            <div className="section-title">
              <span>Belge Detayı</span>
              <X size={16} />
            </div>
            <div className="document-file-line">
              <FileText size={22} />
              <strong>{selectedDocument?.fileName ?? "Garanti_Bonus_1205_2026.pdf"}</strong>
            </div>
            <dl>
              <div><dt>Yükleme Tarihi</dt><dd>{selectedDocument ? new Date(selectedDocument.createdAt).toLocaleString("tr-TR") : "12 May 2026 22:14"}</dd></div>
              <div><dt>Belge Tipi</dt><dd>{selectedDocument?.kind ?? "Ekstre"}</dd></div>
              <div><dt>Durum</dt><dd className="green-pill">{selectedDocument?.status ?? "imported"}</dd></div>
              <div><dt>İşlem</dt><dd>{selectedDocument?.itemCount ?? 12}</dd></div>
            </dl>
            <div className="document-side-tabs">
              <span className="active">Özet</span>
              <span>İşlemler</span>
              <span>Uyarılar</span>
            </div>
            <section className="side-subscription-list">
              <h3>Algılanan Abonelikler</h3>
              {["Netflix.com", "Spotify"].map((name, index) => (
                <article key={name}>
                  <span>{name}</span>
                  <strong>{index === 0 ? "₺229,99" : "₺59,99"}/ay</strong>
                  <button><Bell size={14} />Hatırlatıcı Kur</button>
                </article>
              ))}
            </section>
          </aside>
        </section>
      </section>
    </AppShell>
  );
}

function ImpactLite({ label, positive, value }: { label: string; positive?: boolean; value: string }) {
  return (
    <article>
      <span>{label}</span>
      <strong className={positive ? "positive-text" : undefined}>{value}</strong>
    </article>
  );
}
