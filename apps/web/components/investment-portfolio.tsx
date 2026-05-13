"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import type { Currency, InvestmentAssetType, InvestmentPortfolioSummary, MarketSymbolResult } from "@fintwin/shared";
import { addInvestmentHolding, deleteInvestmentHolding, searchMarketSymbols } from "../lib/api";
import { normalizeMarketSymbolQuery, shouldSearchMarketSymbols, type PortfolioFormMode } from "../lib/portfolio-form";

const assetTypes: Array<{ value: InvestmentAssetType; label: string }> = [
  { value: "stock", label: "Hisse" },
  { value: "gold", label: "Altın" },
  { value: "commodity", label: "Emtia" },
  { value: "forex", label: "Döviz" },
  { value: "crypto", label: "Kripto" },
  { value: "fund", label: "Fon" },
  { value: "cash", label: "Nakit / Mevduat" },
  { value: "other", label: "Diğer" }
];

const currencies: Currency[] = ["TRY", "USD", "EUR"];

type FormState = {
  quantity: string;
  averageCost: string;
  costCurrency: Currency;
  assetType: InvestmentAssetType;
  annualInterestRate: string;
};

type InvestmentPortfolioMode = PortfolioFormMode;

type InvestmentPortfolioProps = {
  initialPortfolio: InvestmentPortfolioSummary;
  mode?: InvestmentPortfolioMode;
};

export function InvestmentPortfolio({ initialPortfolio, mode = "overview" }: InvestmentPortfolioProps) {
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MarketSymbolResult[]>([]);
  const [selected, setSelected] = useState<MarketSymbolResult | null>(null);
  const [form, setForm] = useState<FormState>({ quantity: "1", averageCost: "", costCurrency: "TRY", assetType: "stock", annualInterestRate: "" });
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isCash = form.assetType === "cash";

  useEffect(() => {
    const trimmedQuery = normalizeMarketSymbolQuery(query);
    if (!shouldSearchMarketSymbols({ mode, isCash, query: trimmedQuery })) {
      setResults([]);
      return undefined;
    }
    const handle = setTimeout(() => {
      void searchMarketSymbols(trimmedQuery)
        .then(setResults)
        .catch((caught) => {
          setResults([]);
          setMessage(caught instanceof Error ? caught.message : "Sembol araması başarısız.");
        });
    }, 260);
    return () => clearTimeout(handle);
  }, [isCash, mode, query]);

  const sourceLabel = useMemo(() => {
    return portfolio.hasMarketDataGap ? "Piyasa verisi eksik" : "Twelve Data";
  }, [portfolio.hasMarketDataGap]);

  async function submit() {
    const symbol = isCash ? undefined : selected?.symbol ?? query.trim().toUpperCase();
    if (!isCash && !symbol) {
      setMessage(isCash ? "Tutar gerekli." : "Sembol ve adet gerekli.");
      return;
    }

    setIsBusy(true);
    setMessage(null);
    try {
      const quantity = parseRequiredPositiveNumber(form.quantity, isCash ? "Tutar" : "Adet");
      const averageCost = isCash ? 1 : parseRequiredPositiveNumber(form.averageCost, "Alış fiyatı");
      const annualInterestRate = isCash ? parseOptionalPositiveNumber(form.annualInterestRate, "Yıllık faiz oranı") : undefined;
      const next = await addInvestmentHolding({
        symbol,
        name: isCash ? query.trim() || `Nakit / Mevduat ${form.costCurrency}` : selected?.name,
        assetType: isCash ? "cash" : selected?.assetType ?? form.assetType,
        quantity,
        averageCost,
        costCurrency: form.costCurrency,
        exchange: isCash ? undefined : selected?.exchange,
        micCode: isCash ? undefined : selected?.micCode,
        marketCurrency: isCash ? form.costCurrency : selected?.currency,
        annualInterestRate
      });
      setPortfolio(next);
      setSelected(null);
      setQuery("");
      setForm((current) => ({ ...current, quantity: "1", averageCost: "", annualInterestRate: "" }));
      setMessage("Varlık portföye eklendi.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Varlık eklenemedi.");
    } finally {
      setIsBusy(false);
    }
  }

  async function remove(id: string) {
    setIsBusy(true);
    try {
      setPortfolio(await deleteInvestmentHolding(id));
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Pozisyon silinemedi.");
    } finally {
      setIsBusy(false);
    }
  }

  const formPanel = (
    <div className={`panel investment-form${mode === "add" ? " investment-form-focused" : ""}`}>
      <div className="section-title">
        <span>Varlık ekle</span>
        <strong>{isCash ? "Banka bakiyesi" : selected?.symbol ?? "Sembol ara"}</strong>
      </div>

      <label className="field">
        <span>{isCash ? "Banka / hesap adı" : "Sembol"}</span>
        <div className="search-input">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(null);
            }}
            placeholder={isCash ? "Vadeli mevduat, vadesiz hesap" : "THYAO, AAPL, XAU, USD/TRY"}
          />
        </div>
      </label>

      {!isCash && results.length > 0 ? (
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
          <span>Tür</span>
          <select
            value={form.assetType}
            onChange={(event) => {
              const nextType = event.target.value as InvestmentAssetType;
              setForm((current) => ({ ...current, assetType: nextType, averageCost: nextType === "cash" ? "" : current.averageCost }));
              if (nextType === "cash") {
                setSelected(null);
                setResults([]);
              }
            }}
          >
            {assetTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{isCash ? "Tutar" : "Adet / miktar"}</span>
          <input value={form.quantity} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))} />
        </label>
        {!isCash ? (
          <label className="field">
            <span>Alış fiyatı</span>
            <input value={form.averageCost} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, averageCost: event.target.value }))} />
          </label>
        ) : null}
        <label className="field">
          <span>{isCash ? "Para birimi" : "Maliyet para birimi"}</span>
          <select value={form.costCurrency} onChange={(event) => setForm((current) => ({ ...current, costCurrency: event.target.value as Currency }))}>
            {currencies.map((currency) => (
              <option key={currency} value={currency}>
                {currency}
              </option>
            ))}
          </select>
        </label>
        {isCash ? (
          <label className="field">
            <span>Yıllık faiz oranı (%)</span>
            <input value={form.annualInterestRate} inputMode="decimal" onChange={(event) => setForm((current) => ({ ...current, annualInterestRate: event.target.value }))} />
          </label>
        ) : null}
      </div>

      <button className="secondary-button portfolio-submit" type="button" onClick={() => void submit()} disabled={isBusy}>
        <Plus size={18} />
        {isBusy ? "Ekleniyor" : "Portföye ekle"}
      </button>
      {message ? <p className="form-message">{message}</p> : null}
    </div>
  );

  if (mode === "add") {
    return (
      <section className="portfolio-add-layout" aria-label="Portföye varlık ekle">
        <div className="panel portfolio-add-intro">
          <Link className="text-link back-link" href="/portfolio">
            <ArrowLeft size={16} />
            Portföye dön
          </Link>
          <div>
            <p className="eyebrow">Yeni kayıt</p>
            <h2>Tek varlık, temiz form.</h2>
            <p className="panel-copy">
              Hisse, altın, döviz, kripto, fon veya vadeli mevduatı buradan ekle. Portföy özeti eklemeden sonra aynı oturumda güncellenir.
            </p>
          </div>
        </div>

        {formPanel}

        <aside className="panel portfolio-add-preview">
          <div className="section-title">
            <span>Mevcut portföy</span>
            <strong>{formatTry(portfolio.totalMarketValueTry)}</strong>
          </div>
          <div className="portfolio-summary compact">
            <div>
              <span>Pozisyon</span>
              <strong>{portfolio.positions.length}</strong>
            </div>
            <div>
              <span>Günlük faiz</span>
              <strong className={portfolio.totalDailyInterestTry > 0 ? "positive" : undefined}>{formatTry(portfolio.totalDailyInterestTry)}</strong>
            </div>
          </div>
          <Link className="secondary-button portfolio-submit" href="/portfolio">
            Portföyü görüntüle
          </Link>
        </aside>
      </section>
    );
  }

  return (
    <section className="portfolio-grid portfolio-grid-overview" aria-label="Yatırım portföyü">
      <div className="panel investment-panel">
        <div className="section-title portfolio-title-row">
          <div>
            <span>Yatırım portföyü</span>
            <strong>{formatTry(portfolio.totalMarketValueTry)}</strong>
          </div>
          <Link className="secondary-button portfolio-add-cta" href="/portfolio/add">
            <Plus size={17} />
            Varlık ekle
          </Link>
        </div>
        <div className="portfolio-summary">
          <div>
            <span>Maliyet</span>
            <strong>{formatTry(portfolio.totalCostTry)}</strong>
          </div>
          <div>
            <span>{portfolio.hasMarketDataGap ? "Kar / zarar (fiyatlı)" : "Kar / zarar"}</span>
            <strong className={portfolio.totalProfitLossTry >= 0 ? "positive" : "negative"}>
              {portfolio.totalProfitLossTry >= 0 ? "+" : ""}
              {formatTry(portfolio.totalProfitLossTry)} ({portfolio.totalProfitLossPercent.toLocaleString("tr-TR")}%)
            </strong>
          </div>
          <div>
            <span>Günlük faiz</span>
            <strong className={portfolio.totalDailyInterestTry > 0 ? "positive" : undefined}>{formatTry(portfolio.totalDailyInterestTry)}</strong>
          </div>
          <div>
            <span>Gün sonu toplam</span>
            <strong>{formatTry(portfolio.projectedEndOfDayValueTry)}</strong>
          </div>
          <div>
            <span>Veri</span>
            <strong>{sourceLabel}</strong>
          </div>
        </div>
        {portfolio.warning ? <p className="form-message">{portfolio.warning}</p> : null}

        {portfolio.allocation.length > 0 ? (
          <div className="allocation-strip">
            {portfolio.allocation.map((item) => (
              <div key={item.assetType}>
                <span>{item.label}</span>
                <strong>{item.weight.toLocaleString("tr-TR")}%</strong>
                <small>{formatTry(item.valueTry)}</small>
              </div>
            ))}
          </div>
        ) : null}

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
                    {position.isPriced ? `${formatNumber(position.quote.price)} ${position.quote.currency}` : "Alınamadı"}
                  </strong>
                </div>
                <div>
                  <span>Değer</span>
                  <strong>{position.isPriced ? formatTry(position.marketValueTry) : "-"}</strong>
                  {position.dailyInterestTry > 0 ? <small>+{formatTry(position.dailyInterestTry)} günlük faiz</small> : null}
                  {!position.isPriced && position.marketDataMessage ? <small>{position.marketDataMessage}</small> : null}
                </div>
                <div className={position.isPriced ? (isUp ? "positive" : "negative") : undefined}>
                  {position.isPriced ? (isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />) : null}
                  <strong>{position.isPriced ? `${isUp ? "+" : ""}${formatTry(position.profitLossTry)}` : "Hesaplanamadı"}</strong>
                </div>
                <button className="ghost-icon" type="button" onClick={() => void remove(position.id)} disabled={isBusy} aria-label={`${position.symbol} sil`}>
                  <Trash2 size={16} />
                </button>
              </article>
            );
          })}
        </div>
        <p className="market-note">Piyasa fiyatları backend cache ile günde bir kez yenilenir. Nakit ve mevduat pozisyonları günlük faiz projeksiyonuna dahil edilir.</p>
        {message ? <p className="form-message">{message}</p> : null}
      </div>

    </section>
  );
}

function parseRequiredPositiveNumber(value: string, field: string): number {
  const parsed = parseOptionalPositiveNumber(value, field);
  if (parsed === undefined) throw new Error(`${field} gerekli.`);
  return parsed;
}

function parseOptionalPositiveNumber(value: string, field: string): number | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${field} pozitif sayı olmalı.`);
  return parsed;
}

function formatTry(value: number): string {
  return `${formatNumber(value)} TL`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(value);
}
