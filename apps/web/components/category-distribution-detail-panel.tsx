"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import type { DashboardSummary, Transaction } from "@fintwin/shared";
import type { LucideIcon } from "lucide-react";
import { ArrowDownWideNarrow, BookOpen, Car, HeartPulse, Home, MoreHorizontal, ReceiptText, Repeat2, Shirt, ShoppingBasket, Smartphone, Utensils, X } from "lucide-react";
import { formatCurrency } from "../lib/format";

type CategoryBreakdownItem = DashboardSummary["categoryBreakdown"][number];

export function CategoryDistributionDetailPanel({ dashboard, transactions }: { dashboard: DashboardSummary; transactions: Transaction[] }) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const total = dashboard.categoryBreakdown.reduce((sum, item) => sum + item.value, 0);
  const sorted = useMemo(() => [...dashboard.categoryBreakdown].sort((left, right) => right.value - left.value), [dashboard.categoryBreakdown]);
  const selectedCategory = sorted.find((item) => item.categoryId === selectedCategoryId) ?? null;
  const topCategory = sorted[0];
  const chartGradient = useMemo(() => semiCircleGradient(sorted, total), [sorted, total]);
  const periodExpenses = useMemo(
    () =>
      transactions.filter((transaction) => {
        const date = transactionDateKey(transaction.occurredAt);
        return transaction.type === "expense" && date >= dashboard.periodStart && date <= dashboard.periodEnd;
      }),
    [dashboard.periodEnd, dashboard.periodStart, transactions]
  );
  const selectedTransactions = useMemo(
    () =>
      selectedCategory
        ? periodExpenses
            .filter((transaction) => transaction.categoryId === selectedCategory.categoryId)
            .sort((left, right) => right.amount - left.amount || right.occurredAt.localeCompare(left.occurredAt))
        : [],
    [periodExpenses, selectedCategory]
  );

  useEffect(() => {
    if (!selectedCategory) return;
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedCategoryId(null);
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => document.removeEventListener("keydown", closeWithEscape);
  }, [selectedCategory]);

  return (
    <section className="detail-stack">
      <div className="insight-grid four">
        <StatTile label="Toplam gider" value={formatMoney(dashboard.expenses)} caption={dashboard.periodLabel} />
        <StatTile label="Kategori sayısı" value={`${dashboard.categoryBreakdown.length}`} caption="Bu dönem işlem görülen kategoriler." />
        <StatTile label="En yüksek kategori" value={topCategory?.name ?? "Yok"} caption={topCategory ? formatMoney(topCategory.value) : "Veri bekleniyor"} />
        <StatTile label="Tasarruf oranı" value={`%${formatNumber(dashboard.savingsRate)}`} caption="Gelir-gider dengesinden hesaplandı." />
      </div>

      <div className="panel detail-panel">
        <div className="section-title">
          <span>Kategori dağılımı</span>
          <strong>{dashboard.periodLabel}</strong>
        </div>
        {sorted.length ? (
          <div className="category-distribution-grid">
            <div className="category-semicircle-panel" aria-label="Kategori yarım daire grafiği">
              <div className="category-semicircle-shell">
                <div className="category-semicircle" style={{ background: chartGradient }} />
              </div>
              <div className="category-semicircle-total">
                <span>Toplam</span>
                <strong>{formatMoney(total)}</strong>
              </div>
            </div>
            <div className="category-detail-list">
              {sorted.map((item) => {
                const percent = total > 0 ? (item.value / total) * 100 : 0;
                const isSelected = item.categoryId === selectedCategoryId;
                const Icon = categoryIcon(item.name);
                return (
                  <button
                    className={isSelected ? "category-detail-row category-detail-button active" : "category-detail-row category-detail-button"}
                    key={item.categoryId}
                    onClick={() => setSelectedCategoryId(item.categoryId)}
                    type="button"
                  >
                    <span className="category-icon" style={{ "--category-color": item.color } as CSSProperties}>
                      <Icon size={17} />
                    </span>
                    <div>
                      <strong>{item.name}</strong>
                      <span>{formatMoney(item.value)}</span>
                    </div>
                    <div className="category-share">
                      <span>%{formatNumber(percent)}</span>
                      <div className="progress-track" aria-hidden="true">
                        <span style={{ background: item.color, width: `${Math.max(4, Math.min(percent, 100))}%` }} />
                      </div>
                    </div>
                    <span className="category-row-cta">Harcamaları aç</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <EmptyDetail message="Fiş, ekstre veya manuel işlem eklenince kategori dağılımı burada detaylı görünür." />
        )}
      </div>

      {selectedCategory ? (
        <CategoryExpenseDrawer category={selectedCategory} onClose={() => setSelectedCategoryId(null)} periodLabel={dashboard.periodLabel} transactions={selectedTransactions} />
      ) : null}
    </section>
  );
}

function CategoryExpenseDrawer({
  category,
  onClose,
  periodLabel,
  transactions
}: {
  category: CategoryBreakdownItem;
  onClose: () => void;
  periodLabel: string;
  transactions: Transaction[];
}) {
  const highest = transactions[0];
  return (
    <>
      <div className="category-drawer-backdrop" onMouseDown={onClose} role="presentation" />
      <aside className="category-drawer" role="dialog" aria-label={`${category.name} harcamaları`} aria-modal="true">
        <header className="category-drawer-header">
          <div>
            <span className="eyebrow">Kategori harcamaları</span>
            <h2>{category.name}</h2>
            <p>{periodLabel} içinde pahalıdan ucuza sıralandı.</p>
          </div>
          <button className="ghost-icon category-drawer-close" onClick={onClose} type="button" aria-label="Kategori harcamalarını kapat">
            <X size={18} />
          </button>
        </header>

        <div className="category-drawer-summary">
          <MiniStat label="Toplam" value={formatMoney(category.value)} />
          <MiniStat label="İşlem" value={`${transactions.length}`} />
          <MiniStat label="En yüksek" value={highest ? formatMoney(highest.amount, highest.currency) : "Yok"} />
        </div>

        {transactions.length ? (
          <div className="category-transaction-list">
            <div className="category-sort-label">
              <ArrowDownWideNarrow size={16} />
              <span>Tutar azalan sıralama</span>
            </div>
            {transactions.map((transaction) => (
              <article className="category-transaction-row" key={transaction.id}>
                <div className="transaction-icon">
                  <ReceiptText size={17} />
                </div>
                <div>
                  <strong>{transaction.merchant}</strong>
                  <span>
                    {formatDate(transaction.occurredAt)} · {paymentMethodLabel(transaction.paymentMethod)}
                  </span>
                </div>
                <strong>{formatMoney(transaction.amount, transaction.currency)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <EmptyDetail message="Bu kategoride seçili dönem için işlem bulunamadı." />
        )}
      </aside>
    </>
  );
}

function StatTile({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <article className="detail-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{caption}</small>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="category-mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyDetail({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>;
}

function formatMoney(value: number, currency = "TRY") {
  return formatCurrency(Math.round(value), currency);
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? value.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "0";
}

function transactionDateKey(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function paymentMethodLabel(method: Transaction["paymentMethod"]) {
  if (method === "cash") return "Nakit";
  if (method === "debit_card") return "Banka kartı";
  if (method === "credit_card") return "Kredi kartı";
  return "Transfer";
}

function semiCircleGradient(items: CategoryBreakdownItem[], total: number) {
  if (!items.length || total <= 0) return "conic-gradient(from 270deg, #e2e8f0 0deg 180deg, transparent 180deg 360deg)";
  let cursor = 0;
  const stops = items.map((item) => {
    const start = cursor;
    const size = Math.max(2, (item.value / total) * 180);
    cursor = Math.min(180, cursor + size);
    return `${item.color} ${start.toFixed(2)}deg ${cursor.toFixed(2)}deg`;
  });
  if (cursor < 180) stops.push(`#e2e8f0 ${cursor.toFixed(2)}deg 180deg`);
  return `conic-gradient(from 270deg, ${stops.join(", ")}, transparent 180deg 360deg)`;
}

function categoryIcon(name: string): LucideIcon {
  const normalized = name.toLocaleLowerCase("tr-TR");
  if (normalized.includes("market")) return ShoppingBasket;
  if (normalized.includes("yemek")) return Utensils;
  if (normalized.includes("kira")) return Home;
  if (normalized.includes("ulaş") || normalized.includes("ulas")) return Car;
  if (normalized.includes("giyim")) return Shirt;
  if (normalized.includes("eğitim") || normalized.includes("egitim")) return BookOpen;
  if (normalized.includes("sağlık") || normalized.includes("saglik")) return HeartPulse;
  if (normalized.includes("teknoloji")) return Smartphone;
  if (normalized.includes("abonelik")) return Repeat2;
  return MoreHorizontal;
}
