import { AppShell } from "../../components/app-shell";
import { ReceiptScanner } from "../../components/receipt-scanner";
import { requireAuthToken } from "../../lib/server-auth";

export default async function ReceiptPage() {
  await requireAuthToken();
  return (
    <AppShell active="/receipt">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Belge Agent'ları</p>
          <h1>Fiş ve ekstreyi otomatik gider kayıtlarına dönüştür.</h1>
        </div>
      </header>
      <ReceiptScanner />
    </AppShell>
  );
}
