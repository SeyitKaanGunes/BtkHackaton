import { AppShell } from "../../components/app-shell";
import { ReceiptScanner } from "../../components/receipt-scanner";

export default function ReceiptPage() {
  return (
    <AppShell active="/receipt">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Mobil Fiş/Fatura Okuma</p>
          <h1>Qwen ile belgeyi finans kaydına dönüştür.</h1>
        </div>
      </header>
      <ReceiptScanner />
    </AppShell>
  );
}
