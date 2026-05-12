import { AppShell } from "../../components/app-shell";
import { ReceiptScanner } from "../../components/receipt-scanner";
import { requirePersonalSession } from "../../lib/server-auth";

export default async function ReceiptPage() {
  const { user } = await requirePersonalSession();
  return (
    <AppShell active="/receipt" accountType={user.accountType}>
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
