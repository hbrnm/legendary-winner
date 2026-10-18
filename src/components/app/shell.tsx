"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { BookOpen, Cloud, CloudOff, Home, Loader2, RefreshCw, Settings, ShoppingBasket, Warehouse, Wallet, CalendarDays, AlertTriangle } from "lucide-react";
import { useApp } from "./app-provider";
import { Spinner } from "@/components/ui/misc";
import { useData } from "./hooks";
import { owned } from "@/lib/services/queries";
import { expiringSoon } from "@/lib/domain/pantry";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import { notifyExpiring } from "@/lib/notifications";

/** O notificare pe zi (dacă utilizatorul a activat-o) pentru produsele care expiră. */
function ExpiryNotifier() {
  const today = toISODate(now());
  const names = useData(async (ctx) => expiringSoon(await owned(ctx.db, "pantry_items", ctx.householdId), today, 1).map((i) => i.name), [today]);
  useEffect(() => {
    if (names?.length) void notifyExpiring(names, today);
  }, [names, today]);
  return null;
}

const NAV = [
  { href: "/", label: "Acasă", icon: Home, match: (p: string) => p === "/" },
  { href: "/cumparaturi/", label: "Cumpărături", icon: ShoppingBasket, match: (p: string) => p.startsWith("/cumparaturi") },
  { href: "/retete/", label: "Rețete", icon: BookOpen, match: (p: string) => p.startsWith("/retete") || p.startsWith("/plan") },
  { href: "/buget/", label: "Buget", icon: Wallet, match: (p: string) => p.startsWith("/buget") },
  { href: "/camara/", label: "Cămară", icon: Warehouse, match: (p: string) => p.startsWith("/camara") },
];

function SyncIndicator() {
  const { mode, sync, syncNow } = useApp();
  if (mode === "demo") return null;
  const state = sync?.state ?? "inactiv";
  const pending = sync?.pending ?? 0;
  const label =
    state === "sincronizare"
      ? "Se sincronizează"
      : state === "offline"
        ? pending > 0
          ? `Offline · ${pending} ${pending === 1 ? "modificare" : "modificări"} în așteptare`
          : "Offline"
        : state === "eroare"
          ? "Sincronizare oprită"
          : pending > 0
            ? `${pending} în așteptare`
            : "Sincronizat";
  const Icon = state === "sincronizare" ? Loader2 : state === "offline" ? CloudOff : state === "eroare" ? AlertTriangle : pending > 0 ? RefreshCw : Cloud;
  return (
    <button
      type="button"
      onClick={() => void syncNow()}
      title={`${label}. Apasă pentru a sincroniza acum.`}
      aria-label={`${label}. Sincronizează acum`}
      className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${state === "offline" ? "bg-warn-soft text-warn" : state === "eroare" ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"}`}
    >
      <Icon size={14} className={state === "sincronizare" ? "animate-spin" : ""} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function RejectedNotice() {
  const { sync } = useApp();
  if (!sync?.rejected) return null;
  const others = sync.rejected - sync.rejected_photos;
  return (
    <div className="mb-4 space-y-1 rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent" role="alert">
      {sync.rejected_photos > 0 && <p>Fotografia nu a putut fi salvată. Pune-o din nou.</p>}
      {others > 0 && (
        <p>
          {others === 1 ? "O modificare nu a putut fi salvată" : `${others} modificări nu au putut fi salvate`} pe server și au fost anulate pe acest telefon. Verifică datele și
          refă modificarea, dacă e nevoie.
        </p>
      )}
    </div>
  );
}

/**
 * Cadrul paginilor aplicației: verifică autentificarea și gospodăria, apoi
 * afișează navigația (jos pe telefon, lateral pe ecrane mari).
 */
export function AppShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const app = useApp();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Cu tot cu parametri: linkul partajat spre /retete/import/ ajunge acolo și după conectare.
    if (app.status === "signed_out") router.replace(`/autentificare/?inapoi=${encodeURIComponent(pathname + window.location.search)}`);
    if (app.status === "no_household" && !pathname.startsWith("/gospodarie")) router.replace("/gospodarie/");
  }, [app.status, pathname, router]);

  if (app.status === "error") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-medium">Aplicația nu a putut porni.</p>
        <p className="mt-2 text-sm text-ink-2">Reîncarcă pagina. Dacă problema continuă, verifică dacă browserul permite stocarea datelor pentru acest site.</p>
      </div>
    );
  }
  const ready = app.status === "ready" || (app.status === "no_household" && pathname.startsWith("/gospodarie"));

  return (
    <div className="min-h-dvh lg:flex">
      <nav aria-label="Navigare principală" className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-3 font-serif text-xl font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-brand text-brand-ink">
            <Warehouse size={18} />
          </span>
          Cămara
        </Link>
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={n.match(pathname) ? "page" : undefined}
            className={`mb-1 flex h-11 items-center gap-3 rounded-md border-l-2 px-3 text-[15px] transition-colors duration-150 ease-out ${n.match(pathname) ? "border-brand font-medium text-brand" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"}`}
          >
            <n.icon size={20} strokeWidth={1.75} />
            {n.label}
          </Link>
        ))}
        <Link href="/plan/" className={`mb-1 flex h-11 items-center gap-3 rounded-md border-l-2 px-3 text-[15px] transition-colors duration-150 ease-out ${pathname.startsWith("/plan") ? "border-brand font-medium text-brand" : "border-transparent text-ink-2 hover:bg-surface-2 hover:text-ink"}`}>
          <CalendarDays size={20} strokeWidth={1.75} />
          Planul meselor
        </Link>
        <div className="mt-auto">
          <Link href="/gospodarie/" className="flex h-11 items-center gap-3 rounded-md border-l-2 border-transparent px-3 text-[15px] text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2 hover:text-ink">
            <Settings size={20} strokeWidth={1.75} />
            Gospodărie și setări
          </Link>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-line bg-bg">
          <div className={`mx-auto flex h-14 items-center justify-between gap-2 px-4 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
            <Link href="/" className="flex min-w-0 items-center gap-2 font-serif text-[17px] font-semibold tracking-tight lg:hidden">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand text-brand-ink">
                <Warehouse size={16} />
              </span>
              {app.household?.name ?? "Cămara"}
            </Link>
            <span className="hidden font-serif text-[17px] font-semibold tracking-tight lg:block">{app.household?.name}</span>
            <div className="flex items-center gap-1">
              <SyncIndicator />
              <Link href="/gospodarie/" aria-label="Gospodărie și setări" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2 lg:hidden">
                <Settings size={20} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </header>
        {app.mode === "demo" && (
          <p className="border-b border-dashed border-line px-4 py-1.5 text-center text-xs text-ink-2">
            <span className="font-semibold uppercase tracking-wider text-ink">Mod demonstrativ</span>: datele rămân doar pe acest dispozitiv și nu se sincronizează.
          </p>
        )}
        <main className={`mx-auto px-4 pb-28 pt-5 lg:pb-12 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          <RejectedNotice />
          {ready ? children : <Spinner />}
          {app.status === "ready" && <ExpiryNotifier />}
        </main>
      </div>

      <nav aria-label="Navigare principală" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface lg:hidden">
        <div className="mx-auto flex max-w-lg">
          {NAV.map((n) => {
            const active = n.match(pathname);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors duration-150 ease-out ${active ? "text-brand" : "text-ink-2 active:text-ink"}`}
              >
                {active && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-brand" />}
                <n.icon size={22} strokeWidth={active ? 2 : 1.75} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
