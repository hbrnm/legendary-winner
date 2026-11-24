"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Check, Cloud, CloudOff, Loader2, RefreshCw, Settings, AlertTriangle } from "lucide-react";
import { CaptureHost } from "@/components/capture/capture-host";
import { BrandMark } from "@/components/ui/brand-mark";
import { isCloudConfigured } from "@/lib/supabase/client";
import { BasketIcon, HouseIcon, JarIcon, PurseIcon, RecipeBookIcon } from "@/components/ui/icons";
import { useApp } from "./app-provider";
import { Spinner } from "@/components/ui/misc";
import { useData } from "./hooks";
import { owned } from "@/lib/services/queries";
import { expiringSoon } from "@/lib/domain/pantry";
import { toISODate } from "@/lib/domain/dates";
import { now, nowIso } from "@/lib/clock";
import { notifyExpiring } from "@/lib/notifications";
import { sweepConsumed } from "@/lib/services/kitchen";
import { useToast } from "@/components/ui/toast";

/** O notificare pe zi (dacă utilizatorul a activat-o) pentru produsele care expiră. */
function ExpiryNotifier() {
  const today = toISODate(now());
  const names = useData(async (ctx) => expiringSoon(await owned(ctx.db, "pantry_items", ctx.householdId), today, 1).map((i) => i.name), [today]);
  useEffect(() => {
    if (names?.length) void notifyExpiring(names, today);
  }, [names, today]);
  return null;
}

/** Pornirea aplicației: ștergerea așteaptă o sincronizare de după ea. */
const OPENED_AT = nowIso();
/** Gospodăria și ziua deja verificate (o dată pe zi, oricâte ecrane se deschid). */
let sweptFor: string | null = null;

/**
 * Scoate din cămară ce se consideră consumat (.tasks/016) și spune câte. Cu
 * cont, doar după o sincronizare reușită în această pornire, ca un telefon
 * rămas offline să nu șteargă un produs prelungit între timp pe alt telefon.
 */
function ConsumedSweeper() {
  const { ctx, mode, sync } = useApp();
  const toast = useToast();
  const synced = mode === "demo" || (sync?.last_synced_at != null && sync.last_synced_at >= OPENED_AT);
  useEffect(() => {
    if (!ctx || !synced) return;
    const today = toISODate(now());
    const key = `${ctx.householdId}|${today}`;
    if (sweptFor === key) return;
    sweptFor = key;
    sweepConsumed(ctx, today)
      .then((n) => n > 0 && toast(`Am scos din cămară ${n === 1 ? "un produs" : `${n} produse`}, probabil ${n === 1 ? "consumat" : "consumate"}.`))
      .catch((e) => {
        sweptFor = null;
        console.error(e);
      });
  }, [ctx, synced, toast]);
  return null;
}

const NAV = [
  { href: "/", label: "Acasă", icon: HouseIcon, match: (p: string) => p === "/" },
  { href: "/retete/", label: "Rețete", icon: RecipeBookIcon, match: (p: string) => p.startsWith("/retete") || p.startsWith("/plan") },
  { href: "/camara/", label: "Cămară", icon: JarIcon, match: (p: string) => p.startsWith("/camara") },
  { href: "/cumparaturi/", label: "Cumpărături", icon: BasketIcon, match: (p: string) => p.startsWith("/cumparaturi") },
  { href: "/buget/", label: "Buget", icon: PurseIcon, match: (p: string) => p.startsWith("/buget") },
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
      className={`inline-flex h-12 items-center gap-1.5 rounded-full px-3 text-xs font-medium ${state === "offline" ? "bg-warn-soft text-warn" : state === "eroare" ? "bg-accent-soft text-accent" : "bg-surface-2 text-ink-2"}`}
    >
      <span className="relative"><Icon size={20} className={state === "sincronizare" ? "animate-spin" : ""} />{pending === 0 && sync?.last_synced_at && state === "sincronizat" && <Check size={11} className="absolute -bottom-0.5 -right-1 rounded-full bg-surface text-info" strokeWidth={3} />}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function RejectedNotice() {
  const { sync } = useApp();
  if (!sync?.rejected) return null;
  const others = sync.rejected - sync.rejected_photos;
  return (
    <div className="mb-4 space-y-1 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-accent" role="alert">
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
export function AppShell({ children, wide = false, hideMobileNav = false, captureTarget, mainClassName = "" }: { children: ReactNode; wide?: boolean; hideMobileNav?: boolean; captureTarget?: HTMLElement | null; mainClassName?: string }) {
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
    <div className="app-layout">
      <a
        href="#continut-principal"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-brand-ink focus:shadow-card focus:outline-none"
      >
        Sari la conținutul principal
      </a>
      <nav aria-label="Navigare principală" className="app-sidebar">
        <Link href="/" aria-label="Cămara" className="app-sidebar-brand flex items-center gap-3 text-xl font-semibold tracking-tight rounded-full focus-visible:outline-2 focus-visible:outline-brand">
          <BrandMark />
          <span className="app-sidebar-brand-name">Cămara</span>
        </Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={n.match(pathname) ? "page" : undefined}
            className="app-sidebar-link transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <n.icon size={24} strokeWidth={n.match(pathname) ? 2 : 1.75} />
            <span>{n.label}</span>
          </Link>
        ))}
        <div className="mt-auto pt-6">
          <Link href="/gospodarie/" aria-current={pathname.startsWith("/gospodarie") ? "page" : undefined}
            className="app-sidebar-link focus-visible:outline-2 focus-visible:outline-brand">
            <Settings size={24} strokeWidth={1.75} />
            <span className="hidden min-[1200px]:inline">Gospodărie și setări</span>
            <span className="min-[1200px]:hidden">Setări</span>
          </Link>
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        <header className="app-topbar sticky top-0 z-30">
          <div className={`mx-auto flex h-16 items-center justify-between gap-2 px-4 min-[600px]:px-6 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
            <Link href="/" className="flex min-h-12 min-w-0 flex-col justify-center rounded-md focus-visible:outline-2 focus-visible:outline-brand">
              <span className="truncate font-sans text-[17px] font-semibold tracking-tight">{app.household?.name ?? "Cămara"}</span>
              <span className="text-xs capitalize text-ink-2">{app.status === "ready" ? new Intl.DateTimeFormat("ro-RO", {weekday:"long", day:"numeric", month:"short"}).format(now()) : "\u00a0"}</span>
            </Link>
            <div className="flex items-center gap-1">
              <SyncIndicator />
              <Link href="/gospodarie/" aria-label="Gospodărie și setări" className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-brand">
                <Settings size={20} strokeWidth={1.75} />
              </Link>
            </div>
          </div>
        </header>
        {app.mode === "demo" && (
          <div className="mx-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl bg-surface-container px-4 py-3 text-center text-xs text-ink-2 min-[600px]:mx-6">
            <p><span className="font-semibold uppercase tracking-wider text-ink">Mod demonstrativ</span>: datele rămân doar pe acest dispozitiv și nu se sincronizează.</p>
            {isCloudConfigured && (
              <a href="/autentificare/?demo=0" className="inline-flex min-h-12 items-center justify-center rounded-full bg-brand-soft px-4 font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">Intră în cont</a>
            )}
          </div>
        )}
        <main id="continut-principal" tabIndex={-1} className={`app-main mx-auto focus:outline-none ${wide ? "app-main-wide" : ""} ${mainClassName}`}>
          <RejectedNotice />
          {ready ? children : <Spinner />}
          {app.status === "ready" && <ExpiryNotifier />}
          {app.status === "ready" && <ConsumedSweeper />}
        </main>
      </div>

      {app.status === "ready" && <CaptureHost key={`${app.mode}:${app.userId}:${app.ctx?.householdId}`} inlineTarget={captureTarget} />}
      {!hideMobileNav && <div aria-hidden="true" className="app-nav-fade" />}
      {!hideMobileNav && (
        <nav aria-label="Navigare principală" className="app-mobile-nav fixed z-40">
          <div className="mx-auto flex max-w-lg">
            {NAV.map((n) => {
              const active = n.match(pathname);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`app-mobile-item relative flex flex-1 flex-col items-center justify-center font-medium transition-colors duration-150 ease-out focus-visible:outline-2 focus-visible:outline-brand ${active ? "font-semibold" : "text-ink-2 active:text-ink"}`}
                >
                  <span className="app-mobile-indicator transition-colors"><n.icon size={24} strokeWidth={active ? 2 : 1.75} /></span>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
