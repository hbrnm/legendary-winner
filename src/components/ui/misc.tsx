"use client";

import type { ReactNode } from "react";

export function Card({ children, className = "", as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li" }) {
  return <Tag className={`rounded-2xl border border-line bg-surface shadow-card ${className}`}>{children}</Tag>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2 first:mt-0">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className="font-medium text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

type Tone = "neutral" | "brand" | "accent" | "warn" | "info";
const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  brand: "bg-brand-soft text-brand",
  accent: "bg-accent-soft text-accent",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
};

export function Badge({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>{children}</span>;
}

export function Chip({ active, children, onClick }: { active?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors ${active ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

/** Bară de progres pentru buget: verde până la 85%, galben până la 100%, roșu peste. */
export function BudgetBar({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = pct > 100 ? "bg-accent" : pct >= 85 ? "bg-warn" : "bg-brand";
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full transition-[width] ${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export function Spinner({ label = "Se încarcă" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-10 text-sm text-ink-2">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label}…
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
