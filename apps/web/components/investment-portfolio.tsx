"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import type { Currency, InvestmentAssetType, InvestmentPortfolioSummary, MarketSymbolResult } from "@fintwin/shared";
import { addInvestmentHolding, deleteInvestmentHolding, searchMarketSymbols } from "../lib/api";

const assetTypes: Array<{ value: InvestmentAssetType; label: string }> = [
  { value: "stock", label: "Hisse" },
  { value: "gold", label: "Altin" },
  { value: "commodity", label: "Emtia" },
  { value: "forex", label: "Doviz" },
  { value: "crypto", label: "Kripto" },
  { value: "fund", label: "Fon" },
  { value: "other", label: "Diger" }
];

const currencies: Currency[] = ["TRY", "USD", "EUR"];

type FormState = {
  quantity: string;
  averageCost: string;
  costCurrency: Currency;
  assetType: InvestmentAssetType;
};

export function InvestmentPortfolio({ initialPortfolio }: { initialPortfolio: InvestmentPortfolioSummary }) {
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketSymbolResult[]>([]);
  const [selected, setSelected] = useState<MarketSymbolResult | null>(null);
  const [form, setForm] = useState<FormState>({ quantity: "1", averageCost: "", costCurrency: "TRY", assetType: "stock" });
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      void searchMarketSymbols(query).then(setResults);
    }, 260);
    return () => clearTimeout(handle);
  }, [query]);

  const sourceLabel = useMemo(() => {
    const hasFallback = portfolio.positions.some((item) => item.quote.source === "fallback");
    return hasFallback ? "Twelve Data + fallback" : "Twelve Data";
  }, [portfolio.positions]);

  async function submit() {
    const symbol = selected?.symbol ?? query.trim().toUpperCase();
    const quantity = parseNumber(form.quantity);
    if (!symbol || quantity <= 0) {
      setMessage("Sembol ve adet gerekli.");
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const next = await addInvestmentHolding({
        symbol,
        name: selected?.name,
        assetType: selected?.assetType ?? form.assetType,
        quantity,
        averageCost: parseNumber(form.averageCost),
        costCurrency: form.costCurrency,
        exchange: selected?.exchange,
        micCode: selected?.micCode,
        marketCurrency: selected?.currency
      });
      setPortfolio(next);
      setSelected(null);
      setQuery("");
      setForm((current) => ({ ...current, quantity: "1", averageCost: "" }));
      setMessage("Varlik eklendi.");
    } finally {
      setIsBusy(false);
    }
  }

  async function remove(id: string) {
    setIsBusy(true);
    try {
      setPortfolio(await deleteInvestmentHolding(id));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="portfolio-grid" aria-label="Yatirim portfoyu">
      <div className="panel investment-panel">
        <div className="section-title">
          <span>Yatirim Portfoyu</span>
          <strong>{formatTry(portfolio.totalMarketValueTry)}</strong>
        </div>
        <div className="portfolio-summary">
          <div>
            <span>Maliyet</span>
            <strong>{formatTry(portfolio.totalCostTry)}</strong>
          </div>
          <div>
            <span>Kar / zarar</span>
            <strong className={portfolio.totalProfitLossTry >= 0 ? "positive" : "negative"}>
              {portfolio.totalProfitLossTry >= 0 ? "+" : ""}
              {formatTry(portfolio.totalProfitLossTry)} ({portfolio.totalProfitLossPercent.toLocaleString("tr-TR")}%)
            </strong>
          </div>
          <div>
            <span>Veri</span>
            <strong>{sourceLabel}</strong>
          </div>
        </div>

        <div className="allocation-strip">
          {portfolio.allocation.map((item) => (
            <div key={item.assetType}>
              <span>{item.label}</span>
              <strong>{item.weight.toLocaleString("tr-TR")}%</strong>
              <small>{formatTry(item.valueTry)}</small>
            </div>
          ))}
        </div>

        <div className="position-list">
          {portfolio.positions.map((position) => {
            const isUp = position.profitLossTry >= 0;
            return (
              <article className="position-row" key={position.id}>
                <div>
                  <strong>{position.symbol}</strong>
                  <span>{position.name}</span>
                </div>
                <div>
                  <span>Adet</span>
                  <strong>{position.quantity.toLocaleString("tr-TR")}</strong>
                </div>
                <div>
                  <span>Son fiyat</span>
                  <strong>
                    {formatNumber(position.quote.price)} {position.quote.currency}
                  </strong>
                </div>
                <div>
                  <span>Deger</span>
                  <strong>{formatTry(position.marketValueTry)}</strong>
                </div>
                <div className={isUp ? "positive" : "negative"}>
                  {isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                  <strong>
                    {isUp ? "+" : ""}
                    {formatTry(position.profitLossTry)}
                  </strong>
                </div>
                <button className="ghost-icon" type="button" onClick={() => void remove(position.id)} disabled={isBusy} aria-label={`${position.symbol} sil`}>
                  <Trash2 size={16} />
                </button>
              </article>
            );
          })}
        </div>
        <p className="market-note">Fiyatlar backend cache ile gunde bir kez yenilenir. Bu portfoy finansal saglik skoruna dahil edilmez.</p>
      </div>

      <div className="panel investment-form">
        <div className="section-title">
          <span>Varlik Ekle</span>
          <strong>{selected?.symbol ?? "Sembol ara"}</strong>
        </div>

        <label className="field">
          <span>Sembol</span>
          <div className="search-input">
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="THYAO, XAU, USD/TRY" />
          </div>
        </label>

        {results.length > 0 ? (
          <div className="symbol-results">
            {results.map((item) => (
              <button
                type="button"
                key={`${item.symbol}-${item.exchange ?? "none"}-${item.micCode ?? "none"}`}
                onClick={() => {
                  setSelected(item);
                  setQuery(item.symbol);
                  setForm((current) => ({
                    ...current,
                    assetType: item.assetType,
                    costCurrency: (item.currency === "USD" || item.currency === "EUR" ? item.currency : "TRY") as Currency
                  }));
                }}
                className={selected?.symbol === item.symbol ? "selected" : ""}
              >
                <strong>{item.symbol}</strong>
                <span>{item.name}</span>
                <small>{[item.exchange, item.currency].filter(Boolean).join(" / ") || item.assetType}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="form-grid">
          <label className="field">
            <span>Tur</span>
            <select value={form.assetType} onChange={(event) => setForm((current) => ({ ...current, assetType: event.target.value as InvestmentAssetType }))}>
              {assetTypes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Adet / miktar</span>
            <input value={form.quantity} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
          </label>
          <label className="field">
            <span>Alis fiyati</span>
            <input value={form.averageCost} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, averageCost: event.target.value }))} />
          </label>
          <label className="field">
            <span>Maliyet para birimi</span>
            <select value={form.costCurrency} onChange={(event) => setForm((current) => ({ ...current, costCurrency: event.target.value as Currency }))}>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button className="secondary-button portfolio-submit" type="button" onClick={() => void submit()} disabled={isBusy}>
          <Plus size={18} />
          Ekle
        </button>
        {message ? <p className="form-message">{message}</p> : null}
      </div>
    </section>
  );
}

function parseNumber(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTry(value: number) {
  return `${formatNumber(value)} TL`;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}
