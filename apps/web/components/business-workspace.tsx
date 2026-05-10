"use client";

import { FormEvent, ReactNode, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CalendarPlus, CircleDollarSign, Clock3, Landmark, UserPlus } from "lucide-react";
import type { Business, BusinessCustomer, BusinessDashboard, CollectionScore } from "@fintwin/shared";
import { createBusiness, createBusinessCashEvent, createBusinessCustomer } from "../lib/api";

export type BusinessWorkspaceData = {
  business: Business;
  dashboard: BusinessDashboard;
  customers: BusinessCustomer[];
  scores: CollectionScore[];
};

type Status = { tone: "ok" | "error"; text: string } | null;

export function BusinessWorkspace({ initialData }: { initialData: BusinessWorkspaceData | null }) {
  if (!initialData) return <BusinessOnboarding />;
  return <BusinessDashboardView data={initialData} />;
}

function BusinessOnboarding() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [cashBalance, setCashBalance] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await createBusiness({
        name: name.trim(),
        sector: sector.trim(),
        cashBalance: parseMoney(cashBalance)
      });
      setStatus({ tone: "ok", text: "İşletme oluşturuldu." });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "İşletme oluşturulamadı." });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Ayrı KOBİ Modülü</p>
          <h1>KOBİ profili oluştur.</h1>
          <p className="header-subtitle">Bu hesapta işletme kaydı yok. Başlangıç bilgilerini girince KOBİ dashboard gerçek DB kayıtlarından açılacak.</p>
        </div>
        <div className="health-score">
          <Building2 size={22} />
          <span>Kurulum</span>
          <strong>DB</strong>
        </div>
      </header>

      <section className="panel business-form-panel">
        <div className="section-title">
          <span>İşletme onboarding</span>
          <strong>Yeni kayıt</strong>
        </div>
        <form className="business-form" onSubmit={submit}>
          <label className="field">
            <span>İşletme adı</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} placeholder="Fintwin Studio" />
          </label>
          <label className="field">
            <span>Sektör</span>
            <input value={sector} onChange={(event) => setSector(event.target.value)} required minLength={2} placeholder="SaaS, perakende, lojistik" />
          </label>
          <label className="field">
            <span>Başlangıç kasa bakiyesi</span>
            <input value={cashBalance} onChange={(event) => setCashBalance(event.target.value)} inputMode="decimal" placeholder="250000" />
          </label>
          <button className="secondary-button" type="submit" disabled={pending}>
            {pending ? "Oluşturuluyor" : "İşletme oluştur"}
          </button>
        </form>
        {status ? <p className={`form-message ${status.tone === "error" ? "danger" : ""}`}>{status.text}</p> : null}
      </section>
    </>
  );
}

function BusinessDashboardView({ data }: { data: BusinessWorkspaceData }) {
  const { business, dashboard, customers, scores } = data;
  return (
    <>
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Ayrı KOBİ Modülü</p>
          <h1>{business.name}</h1>
          <p className="header-subtitle">{business.sector} işletme metrikleri oturum kullanıcısına bağlı DB kayıtlarından okunur.</p>
        </div>
        <div className="health-score">
          <Building2 size={22} />
          <span>Likidite riski</span>
          <strong>{riskLabel(dashboard.liquidityRisk)}</strong>
        </div>
      </header>

      <section className="metric-grid">
        <Metric icon={<Landmark size={20} />} label="Kasa" value={formatTry(dashboard.cashBalance)} />
        <Metric icon={<Clock3 size={20} />} label="30 gün" value={formatTry(dashboard.projected30Days)} />
        <Metric icon={<Clock3 size={20} />} label="60 gün" value={formatTry(dashboard.projected60Days)} />
        <Metric icon={<CircleDollarSign size={20} />} label="90 gün" value={formatTry(dashboard.projected90Days)} />
      </section>

      <section className="split-layout">
        <CashEventsPanel businessId={business.id} dashboard={dashboard} />
        <CustomersPanel businessId={business.id} customers={customers} scores={scores} />
      </section>
    </>
  );
}

function CashEventsPanel({ businessId, dashboard }: { businessId: string; dashboard: BusinessDashboard }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"inflow" | "outflow">("inflow");
  const [dueAt, setDueAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await createBusinessCashEvent(businessId, {
        title: title.trim(),
        amount: parseMoney(amount),
        type,
        dueAt
      });
      setTitle("");
      setAmount("");
      setStatus({ tone: "ok", text: "Nakit olayı eklendi." });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Nakit olayı eklenemedi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">
        <span>Nakit Olayları</span>
        <strong>{dashboard.upcomingPayments.length + dashboard.expectedCollections.length} kayıt</strong>
      </div>
      <div className="action-list">
        {[...dashboard.upcomingPayments, ...dashboard.expectedCollections].map((event) => {
          const isInflow = event.type === "inflow";
          return (
            <div className="action-row" key={event.id}>
              <span>{event.title}</span>
              <strong className={isInflow ? "positive-text" : "negative-text"}>{isInflow ? "+" : "-"} {formatTry(event.amount)}</strong>
              <small>{event.dueAt}</small>
            </div>
          );
        })}
        {dashboard.upcomingPayments.length + dashboard.expectedCollections.length === 0 ? <div className="empty-state">Nakit olayı yok.</div> : null}
      </div>
      <form className="business-form compact" onSubmit={submit}>
        <label className="field">
          <span>Başlık</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required placeholder="Müşteri tahsilatı" />
        </label>
        <label className="field">
          <span>Tutar</span>
          <input value={amount} onChange={(event) => setAmount(event.target.value)} required inputMode="decimal" placeholder="50000" />
        </label>
        <label className="field">
          <span>Tür</span>
          <select value={type} onChange={(event) => setType(event.target.value as "inflow" | "outflow")}>
            <option value="inflow">Tahsilat</option>
            <option value="outflow">Ödeme</option>
          </select>
        </label>
        <label className="field">
          <span>Tarih</span>
          <input value={dueAt} onChange={(event) => setDueAt(event.target.value)} required type="date" />
        </label>
        <button className="secondary-button" type="submit" disabled={pending}>
          <CalendarPlus size={16} />
          {pending ? "Ekleniyor" : "Nakit olayı ekle"}
        </button>
      </form>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : ""}`}>{status.text}</p> : null}
    </div>
  );
}

function CustomersPanel({ businessId, customers, scores }: { businessId: string; customers: BusinessCustomer[]; scores: CollectionScore[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [averageDelayDays, setAverageDelayDays] = useState("");
  const [invoicesPaid, setInvoicesPaid] = useState("");
  const [invoicesLate, setInvoicesLate] = useState("");
  const [outstandingAmount, setOutstandingAmount] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await createBusinessCustomer(businessId, {
        name: name.trim(),
        averageDelayDays: parseInteger(averageDelayDays),
        invoicesPaid: parseInteger(invoicesPaid),
        invoicesLate: parseInteger(invoicesLate),
        outstandingAmount: parseMoney(outstandingAmount)
      });
      setName("");
      setAverageDelayDays("");
      setInvoicesPaid("");
      setInvoicesLate("");
      setOutstandingAmount("");
      setStatus({ tone: "ok", text: "Müşteri eklendi." });
      router.refresh();
    } catch (error) {
      setStatus({ tone: "error", text: error instanceof Error ? error.message : "Müşteri eklenemedi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="panel">
      <div className="section-title">
        <span>Tahsilat Skorları</span>
        <strong>{customers.length} müşteri</strong>
      </div>
      {scores.length > 0 ? (
        scores.map((score) => {
          const customer = customers.find((item) => item.id === score.customerId);
          return (
            <div className="score-row" key={score.customerId}>
              <span>{customer?.name ?? score.customerId}</span>
              <strong>{score.score}/100</strong>
              <small>{score.recommendation}</small>
            </div>
          );
        })
      ) : (
        <div className="empty-state">Tahsilat skoru için müşteri kaydı yok.</div>
      )}
      <form className="business-form compact" onSubmit={submit}>
        <label className="field">
          <span>Müşteri adı</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required placeholder="Atlas Perakende" />
        </label>
        <label className="field">
          <span>Ortalama gecikme günü</span>
          <input value={averageDelayDays} onChange={(event) => setAverageDelayDays(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label className="field">
          <span>Ödenen fatura</span>
          <input value={invoicesPaid} onChange={(event) => setInvoicesPaid(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label className="field">
          <span>Geciken fatura</span>
          <input value={invoicesLate} onChange={(event) => setInvoicesLate(event.target.value)} inputMode="numeric" placeholder="0" />
        </label>
        <label className="field">
          <span>Açık bakiye</span>
          <input value={outstandingAmount} onChange={(event) => setOutstandingAmount(event.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        <button className="secondary-button" type="submit" disabled={pending}>
          <UserPlus size={16} />
          {pending ? "Ekleniyor" : "Müşteri ekle"}
        </button>
      </form>
      {status ? <p className={`form-message ${status.tone === "error" ? "danger" : ""}`}>{status.text}</p> : null}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatTry(value: number) {
  return `${Math.round(value).toLocaleString("tr-TR")} TL`;
}

function parseMoney(value: string | number | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number((value ?? "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function riskLabel(level: string) {
  return {
    low: "düşük",
    medium: "orta",
    high: "yüksek",
    critical: "kritik"
  }[level] ?? level;
}
