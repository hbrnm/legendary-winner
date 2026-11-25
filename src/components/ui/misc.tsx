"use client";

import type { ReactNode, Ref } from "react";
import Link from "next/link";
import { ArrowLeft } from "@/components/ui/icons";

export function Card({ children, className = "", as: Tag = "div", variant = "standard", ...rest }: { children: ReactNode; className?: string; as?: "div" | "section" | "article" | "li"; variant?: "standard" | "featured"; id?: string; "aria-label"?: string }) {
  return (
    <Tag className={`app-card ${variant === "featured" ? "app-card-featured" : ""} ${className}`} {...rest}>
      {children}
    </Tag>
  );
}

export function SectionTitle({ children, action, className = "" }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`mb-2 mt-7 flex items-center gap-3 first:mt-0 ${className}`}>
      <h2 className="min-w-0 text-section-title font-semibold tracking-tight text-on-surface">{children}</h2>
      <span aria-hidden className="flex-1" />
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 text-ink-3">{icon}</div>}
      <p className="font-sans text-lg font-semibold text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-3">{action}</div>}
    </Card>
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
      className={`inline-flex h-12 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition duration-150 ease-out active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${active ? "bg-secondary-container font-semibold text-on-secondary-container" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}
    >
      {children}
    </button>
  );
}

/** Bară de progres pentru buget: verde până la 85%, galben până la 100%, roșu peste. */
export function BudgetBar({ pct, label }: { pct: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone = pct > 100 ? "bg-accent" : pct >= 85 ? "bg-tertiary" : "bg-secondary";
  return (
    <div role="progressbar" aria-label={label} aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
      <div className={`h-full rounded-full transition-[width] ${tone}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/**
 * Bară dublă: verde (secondary) pentru ce s-a cheltuit, auriu (tertiary) pentru
 * costul estimat al coșului din listele deschise. Peste buget, partea care
 * depășește e roșie (accent).
 */
export function DualBudgetBar({ spent, pending, total, label }: { spent: number; pending: number; total: number; label: string }) {
  const scale = Math.max(total, spent + pending, 1);
  const pct = (x: number) => `${(Math.max(0, x) / scale) * 100}%`;
  const over = spent + pending > total;
  const usedPct = total > 0 ? Math.round(((spent + pending) / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={usedPct}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative flex h-3 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div data-part="cheltuit" className={`h-full ${spent > total ? "bg-accent" : "bg-secondary"}`} style={{ width: pct(spent) }} />
      <div data-part="cos" className="h-full bg-tertiary" style={{ width: pct(pending) }} />
      {over && total > 0 && <div aria-hidden className="absolute inset-y-0 w-1 -translate-x-1/2 bg-surface shadow-card ring-1 ring-ink/30" style={{ left: pct(total) }} />}
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

export function PageTitle({ children, variant = "editorial", className = "" }: { children: ReactNode; variant?: "editorial" | "compact"; className?: string }) {
  return <h1 className={`min-w-0 break-words text-on-surface ${variant === "editorial" ? "kitchen-display" : "text-2xl font-bold leading-tight tracking-tight"} ${className}`}>{children}</h1>;
}

type PageBack = { href: string; label: string } | { onClick: () => void; label: string };

export function PageHeader({ title, subtitle, action, captureRef, variant = "editorial", back }: { title: string; subtitle?: ReactNode; action?: ReactNode; captureRef?: Ref<HTMLDivElement>; variant?: "editorial" | "compact"; back?: PageBack }) {
  const backClass = "inline-flex size-12 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand";
  return (
    <header className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-2 ${variant === "editorial" ? "mb-6" : "mb-4"}`}>
      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2">
        {back && ("href" in back
          ? <Link href={back.href} aria-label={back.label} className={backClass}><ArrowLeft size={20} aria-hidden /></Link>
          : <button type="button" onClick={back.onClick} aria-label={back.label} className={backClass}><ArrowLeft size={20} aria-hidden /></button>)}
        <div className="min-w-0">
          <PageTitle variant={variant}>{title}</PageTitle>
          {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
        </div>
        {captureRef && <div ref={captureRef} className="ml-auto shrink-0 self-start" />}
      </div>
      {action && (captureRef ? <div className="flex w-full justify-end">{action}</div> : action)}
    </header>
  );
}
