"use client";

import { useState } from "react";
import Link from "next/link";
import { formatRon } from "@/lib/domain/money";

// Grafice simple, o singură serie (o culoare: brand). Valorile sunt scrise
// și sub formă de listă, deci nimic nu depinde doar de culoare.

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Evidențiată (ex. luna curentă). */
  current?: boolean;
  noData?: boolean;
  detail?: string;
}

/** Înălțimile (0–1) coloanelor-schiță din graficul gol: nu sunt date, doar forma graficului. */
const GHOST = [0.45, 0.7, 0.55, 0.85, 0.6, 0.75, 0.5, 0.65];

/** Coloane verticale (ex. ultimele 6 luni). Fără nicio cheltuială, arată o schiță estompată și explicația. */
export function ColumnChart({ bars, title, reference }: { bars: Bar[]; title: string; reference?: { value: number; label: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  if (bars.length > 0 && (bars.every((b) => b.noData) || bars.every((b) => b.noData == null && b.value <= 0))) return <EmptyColumnChart bars={bars} title={title} />;
  const current = bars.find((bar) => bar.current);
  const barText = (bar: Bar) => bar.noData ? "Fără date" : formatRon(bar.value);
  const max = Math.max(1, ...bars.map((b) => b.value), reference?.value ?? 0);
  const W = 320;
  const H = 150;
  const top = 18;
  const base = H - 22;
  const slot = W / bars.length;
  const bw = Math.min(36, slot - 10);
  const y = (v: number) => base - (v / max) * (base - top);

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full overflow-visible" role="img" aria-label={`${title}: ${bars.map((b) => `${b.label} ${barText(b)}`).join(", ")}`}>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line)" strokeWidth={1} />
        {reference && reference.value > 0 && (
          <g>
            <line x1={0} x2={W} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="4 4" />
            <text x={W} y={y(reference.value) - 4} textAnchor="end" fontSize={10} fill="var(--ink-2)">
              {reference.label}
            </text>
          </g>
        )}
        {bars.map((b, i) => {
          const x = i * slot + (slot - bw) / 2;
          const h = Math.max(b.value > 0 ? 2 : 0, base - y(b.value));
          return (
            <g key={b.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${b.label}: ${barText(b)}`}>
              <rect x={i * slot} y={top - 10} width={slot} height={base - top + 10} fill="transparent" />
              <path
                d={h > 0 ? roundedTop(x, base - h, bw, h, Math.min(4, h)) : ""}
                fill="var(--brand)"
                opacity={hover === null || hover === i ? (b.current ? 1 : 0.55) : 0.3}
              />
              {h === 0 && <text x={x + bw / 2} y={base - 5} textAnchor="middle" fontSize={10} fill="var(--ink-2)">{b.noData ? "—" : b.value === 0 ? "0" : ""}</text>}
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={b.current ? "var(--ink)" : "var(--ink-2)"} fontWeight={b.current ? 600 : 400}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {current && <p className="text-sm font-medium text-ink">{current.label} · {barText(current)}</p>}
      {bars.some((bar) => bar.noData) && <p className="text-xs text-ink-2">— Fără date</p>}
      {hover !== null && bars[hover] && (
        <div
          className="pointer-events-none absolute -top-2 rounded-md bg-ink px-2 py-1 text-xs text-bg shadow-card"
          style={{ left: `${((hover + 0.5) / bars.length) * 100}%`, transform: "translateX(-50%)" }}
        >
          {bars[hover].label}: {barText(bars[hover])}
        </div>
      )}
    </figure>
  );
}

function EmptyColumnChart({ bars, title }: { bars: Bar[]; title: string }) {
  const W = 320;
  const H = 150;
  const top = 18;
  const base = H - 22;
  const slot = W / bars.length;
  const bw = Math.min(36, slot - 10);
  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}: încă nicio cheltuială</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" aria-hidden>
        <line x1={0} x2={W} y1={base} y2={base} stroke="var(--line)" strokeWidth={1} />
        {bars.map((b, i) => {
          const h = GHOST[i % GHOST.length] * (base - top);
          const x = i * slot + (slot - bw) / 2;
          return (
            <g key={b.key}>
              <path d={roundedTop(x, base - h, bw, h, 4)} fill="var(--line)" opacity={0.6} />
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--ink-3)">
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="app-card absolute inset-x-0 top-1/3 mx-auto w-fit max-w-[85%] px-3 py-2 text-center text-sm text-ink-2">Graficul se umple după primele cumpărături.</p>
      {bars.every((bar) => bar.noData) && <p className="text-xs text-ink-2">Fără date pentru perioada afișată.</p>}
    </figure>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Bare orizontale cu eticheta și suma scrise (ex. pe categorii). Cu `onSelect`, fiecare bară deschide detaliile categoriei. */
export function BarList({ bars, total, onSelect, hrefFor }: { bars: Bar[]; total: number; onSelect?: (key: string) => void; hrefFor?: (key: string) => string }) {
  const rowClass = "block min-h-11 w-full min-w-0 rounded-xl px-2 py-1 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand";
  return (
    <ul className="flex flex-col gap-2.5">
      {bars.map((b) => {
        const share = total > 0 ? (b.value / total) * 100 : null;
        const shareLabel = share == null ? "—" : share > 0 && share < 1 ? "<1%" : `${Math.round(share)}%`;
        const content = (
          <>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-sm">
              <span className="min-w-0 break-words text-ink">{b.label}</span>
              <span className="shrink-0 text-xs text-ink-2">
                {formatRon(b.value)} <span>· {shareLabel}</span>
              </span>
            </div>
            {b.detail && <p className="mb-1 text-xs tabular text-ink-2">{b.detail}</p>}
            <div className="h-2 rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-r rounded-l-sm bg-brand" style={{ width: `${Math.max(0, Math.min(100, share ?? 0))}%` }} />
            </div>
          </>
        );
        return (
          <li key={b.key} title={`${b.label}: ${formatRon(b.value)}`}>
            {hrefFor ? (
              <div className="flex items-center gap-1">
                <Link href={hrefFor(b.key)} aria-label={`Vezi cheltuielile din ${b.label}`}
                  aria-description={`${formatRon(b.value)} · ${shareLabel}${b.detail ? ` · ${b.detail}` : ""}`}
                  className={rowClass}>{content}</Link>
                {onSelect && <button type="button" onClick={() => onSelect(b.key)} aria-label={`Evoluția cheltuielilor din ${b.label}`}
                  className="min-h-11 shrink-0 rounded-xl px-2 text-xs font-medium text-brand hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand">Evoluție</button>}
              </div>
            ) : onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(b.key)}
                aria-label={`Vezi cheltuielile din ${b.label}`}
                className="-mx-2 block min-h-11 w-[calc(100%+16px)] rounded-xl px-2 py-1 text-left transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
