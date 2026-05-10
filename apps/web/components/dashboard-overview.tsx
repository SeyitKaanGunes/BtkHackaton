"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ArrowRight, Banknote, CircleAlert, PiggyBank, ReceiptText, X } from "lucide-react";

export type DashboardSectionId = "expenses" | "income" | "potential";

export type LedgerRow = {
  label: string;
  value: string;
  meta: string;
  detail?: string;
};

export type AssetRow = {
  label: string;
  weight: number;
  percent: string;
  value: string;
  className: string;
  color: string;
};

export type AssetSegment = AssetRow & {
  offset: number;
};

export type DashboardSection = {
  id: DashboardSectionId;
  className: string;
  eyebrow: string;
  title: string;
  rows: LedgerRow[];
  previewRows: LedgerRow[];
  wide?: boolean;
};

export type DashboardOverviewProps = {
  totalAssets: string;
  assetRows: AssetRow[];
  assetSegments: AssetSegment[];
  sections: DashboardSection[];
  net: {
    title: string;
    progress: number;
    breakdown: LedgerRow[];
  };
};

const sectionIcons: Record<DashboardSectionId, ReactNode> = {
  expenses: <ReceiptText size={18} />,
  income: <Banknote size={18} />,
  potential: <CircleAlert size={18} />
};
const periods = ["Günlük", "Haftalık", "Aylık", "Yıllık"];

gsap.registerPlugin(useGSAP);

export function DashboardOverview({ totalAssets, assetRows, assetSegments, sections, net }: DashboardOverviewProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const [activeId, setActiveId] = useState<DashboardSectionId | null>(null);
  const [activePeriod, setActivePeriod] = useState("Aylık");
  const activeSection = useMemo(() => sections.find((section) => section.id === activeId) ?? null, [activeId, sections]);

  useGSAP(
    () => {
      gsap.from(".sketch-cell", {
        y: 34,
        opacity: 0,
        filter: "blur(10px)",
        duration: 1.05,
        stagger: 0.085,
        ease: "expo.out"
      });
      gsap.from(".asset-arc-segment", {
        scale: 0.94,
        opacity: 0,
        transformOrigin: "50% 100%",
        duration: 1.3,
        stagger: 0.095,
        ease: "expo.out"
      });
      gsap.from(".asset-row", {
        y: 16,
        opacity: 0,
        duration: 0.78,
        stagger: 0.055,
        ease: "power3.out",
        delay: 0.26
      });
      gsap.from(".ledger-list li", {
        y: 12,
        opacity: 0,
        duration: 0.72,
        stagger: 0.035,
        ease: "power2.out",
        delay: 0.22
      });
      gsap.fromTo(".net-arc span", { scaleX: 0 }, { scaleX: 1, transformOrigin: "left center", duration: 1.05, ease: "expo.out", delay: 0.4 });
    },
    { scope: rootRef }
  );

  useGSAP(
    () => {
      gsap.fromTo(".period-switch .active", { scale: 0.96 }, { scale: 1, duration: 0.42, ease: "back.out(2.2)" });
    },
    { dependencies: [activePeriod], scope: rootRef }
  );

  useGSAP(
    () => {
      if (!activeSection) return;
      gsap.fromTo(".detail-drawer", { x: 56, opacity: 0, filter: "blur(8px)" }, { x: 0, opacity: 1, filter: "blur(0px)", duration: 0.56, ease: "expo.out" });
      gsap.from(".detail-drawer-list li", {
        x: 24,
        opacity: 0,
        duration: 0.46,
        stagger: 0.045,
        ease: "power3.out",
        delay: 0.12
      });
    },
    { dependencies: [activeSection] }
  );

  useEffect(() => {
    if (!activeSection) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSection]);

  return (
    <>
      <section ref={rootRef} className="sketch-dashboard" aria-label="Aylık finans özeti">
        <div className="sketch-cell dome-cell">
          <div className="dome-topline">
            <span>Varlık dağılımı</span>
            <strong>{totalAssets}</strong>
          </div>
          <div className="period-switch" aria-label="Zaman periyodu">
            {periods.map((period) => (
              <button
                aria-pressed={activePeriod === period}
                className={activePeriod === period ? "active" : ""}
                key={period}
                onClick={() => setActivePeriod(period)}
                type="button"
              >
                {period}
              </button>
            ))}
          </div>
          <div className="dome-visual" aria-label="Varlık yüzdeleri yarım daire grafiği">
            <svg viewBox="0 0 360 190" role="img" aria-hidden="true">
              <path className="asset-arc-track" d="M 30 170 A 150 150 0 0 1 330 170" pathLength="100" />
              {assetSegments.map((segment) => (
                <path
                  className="asset-arc-segment"
                  d="M 30 170 A 150 150 0 0 1 330 170"
                  key={segment.label}
                  pathLength="100"
                  stroke={segment.color}
                  strokeDasharray={`${segment.weight} ${Math.max(0, 100 - segment.weight)}`}
                  strokeDashoffset={-segment.offset}
                />
              ))}
            </svg>
            <span />
          </div>
          <div className="asset-summary">
            {assetRows.map((asset) => (
              <div className={`asset-row ${asset.className}`} key={asset.label}>
                <span>{asset.label}</span>
                <strong>{asset.percent}</strong>
                <small>{asset.value}</small>
              </div>
            ))}
          </div>
        </div>

        {sections.map((section) => (
          <LedgerPanel key={section.id} section={section} onOpen={() => setActiveId(section.id)} />
        ))}

        <div className="sketch-cell net-cell">
          <div className="panel-heading">
            <span>
              <PiggyBank size={18} />
              Aylık Net Bakiye
            </span>
            <h2>{net.title}</h2>
          </div>
          <div className="net-arc" aria-hidden="true" style={{ "--net-progress": `${net.progress}%` } as CSSProperties}>
            <span />
          </div>
          <div className="net-breakdown">
            {net.breakdown.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
          <button className="sketch-more strong" type="button" onClick={() => setActiveId("potential")}>
            Aksiyon planı
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {activeSection ? <DetailDrawer section={activeSection} onClose={() => setActiveId(null)} /> : null}
    </>
  );
}

function LedgerPanel({ section, onOpen }: { section: DashboardSection; onOpen: () => void }) {
  return (
    <article className={`sketch-cell ledger-panel ${section.className} ${section.wide ? "wide-ledger" : ""}`}>
      <div className="panel-heading">
        <span>
          {sectionIcons[section.id]}
          {section.eyebrow}
        </span>
        <h2>{section.title}</h2>
      </div>
      <ol className="ledger-list">
        {section.previewRows.map((row, index) => (
          <li key={`${row.label}-${row.value}`}>
            <span>{index + 1}</span>
            <div>
              <strong>{row.label}</strong>
              <small>{row.meta}</small>
            </div>
            <em>{row.value}</em>
          </li>
        ))}
      </ol>
      <button className="sketch-more" type="button" onClick={onOpen} aria-haspopup="dialog">
        Tümünü gör
        <ArrowRight size={17} />
      </button>
    </article>
  );
}

function DetailDrawer({ section, onClose }: { section: DashboardSection; onClose: () => void }) {
  return (
    <div className="detail-drawer-shell" role="presentation">
      <button className="detail-drawer-backdrop" type="button" aria-label="Detay panelini kapat" onClick={onClose} />
      <aside className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="detail-drawer-title">
        <div className="detail-drawer-header">
          <div>
            <span>{section.eyebrow}</span>
            <h2 id="detail-drawer-title">{section.title}</h2>
          </div>
          <button className="icon-button quiet" type="button" aria-label="Kapat" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="detail-drawer-summary">
          <span>Toplam kayıt</span>
          <strong>{section.rows.length}</strong>
        </div>

        <ol className="detail-drawer-list">
          {section.rows.map((row, index) => (
            <li key={`${row.label}-${row.value}-${index}`}>
              <span>{index + 1}</span>
              <div>
                <strong>{row.label}</strong>
                <small>{row.meta}</small>
                {row.detail ? <p>{row.detail}</p> : null}
              </div>
              <em>{row.value}</em>
            </li>
          ))}
        </ol>
      </aside>
    </div>
  );
}
