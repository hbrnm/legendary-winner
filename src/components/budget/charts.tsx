"use client";

import { useState } from "react";
import { formatRon } from "@/lib/domain/money";

// Grafice simple, o singură serie (o culoare: brand). Valorile sunt scrise
// și sub formă de listă, deci nimic nu depinde doar de culoare.

export interface Bar {
  key: string;
  label: string;
  value: number;
  /** Evidențiată (ex. luna curentă). */
  current?: boolean;
}

/** Înălțimile (0–1) coloanelor-schiță din graficul gol: nu sunt date, doar forma graficului. */
const GHOST = [0.45, 0.7, 0.55, 0.85, 0.6, 0.75, 0.5, 0.65];

/** Coloane verticale (ex. ultimele 6 luni). Fără nicio cheltuială, arată o schiță estompată și explicația. */
export function ColumnChart({ bars, title, reference }: { bars: Bar[]; title: string; reference?: { value: number; label: string } }) {
  const [hover, setHover] = useState<number | null>(null);
  if (bars.length > 0 && bars.every((b) => b.value <= 0)) return <EmptyColumnChart bars={bars} title={title} />;
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
      <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full overflow-visible" role="img" aria-label={`${title}: ${bars.map((b) => `${b.label} ${formatRon(b.value)}`).join(", ")}`}>
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
            <g key={b.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${b.label}: ${formatRon(b.value)}`}>
              <rect x={i * slot} y={top - 10} width={slot} height={base - top + 10} fill="transparent" />
              <path
                d={h > 0 ? roundedTop(x, base - h, bw, h, Math.min(4, h)) : ""}
                fill="var(--brand)"
                opacity={hover === null || hover === i ? (b.current ? 1 : 0.55) : 0.3}
              />
              <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill={b.current ? "var(--ink)" : "var(--ink-2)"} fontWeight={b.current ? 600 : 400}>
                {b.label}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute -top-2 rounded-md bg-ink px-2 py-1 font-mono text-xs text-bg shadow-card"
          style={{ left: `${((hover + 0.5) / bars.length) * 100}%`, transform: "translateX(-50%)" }}
        >
          {bars[hover].label}: {formatRon(bars[hover].value)}
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
      <p className="absolute inset-x-0 top-1/3 mx-auto w-fit max-w-[85%] rounded-lg border border-line bg-surface px-3 py-2 text-center text-sm text-ink-2">Graficul se umple după primele cumpărături.</p>
    </figure>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number): string {
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Bare orizontale cu eticheta și suma scrise (ex. pe categorii). */
export function BarList({ bars, total }: { bars: Bar[]; total: number }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {bars.map((b) => (
        <li key={b.key} title={`${b.label}: ${formatRon(b.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-ink">{b.label}</span>
            <span className="shrink-0 font-mono text-xs text-ink-2">
              {formatRon(b.value)} <span>· {total > 0 ? Math.round((b.value / total) * 100) : 0}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-r rounded-l-sm bg-brand" style={{ width: `${(b.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
