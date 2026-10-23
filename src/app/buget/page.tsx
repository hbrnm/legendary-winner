"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, Pencil, Plus, Shapes, Tags, Trash2, Wallet } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { BudgetBar, Card, DualBudgetBar, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect, Segmented } from "@/components/ui/fields";
import { BarList, ColumnChart } from "@/components/budget/charts";
import { listItems, owned, priceIndex, spendRecords, visible } from "@/lib/services/queries";
import { createBudget, deleteBudget, updateBudget } from "@/lib/services/money";
import { diverseToSort } from "@/lib/services/receipts";
import { averageTrip, budgetStatus, byCategory, byRetailer, monthlyTotals, SOURCE_LABELS, spendInPeriod, spendToCsv, sumAmounts, weeklyTotals } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { addDays, formatMonth, formatShortDate, monthPeriod, startOfMonth, toISODate } from "@/lib/domain/dates";
import { formatRon, parseMoney, sumMoney } from "@/lib/domain/money";
import { now } from "@/lib/clock";
import { capitalizeFirst, count } from "@/lib/domain/text";
import type { Budget, BudgetPeriod, BudgetScope, PurchaseSource } from "@/lib/domain/types";

const MONTHS_SHORT = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

function scopeLabel(scope: BudgetScope, names: { categories: Map<string, string>; retailers: Map<string, string> }): string {
  switch (scope.kind) {
    case "total":
      return "Toate cumpărăturile";
    case "alimente":
      return "Doar alimente";
    case "nealimentare":
      return "Casă și igienă";
    case "sursa":
      return SOURCE_LABELS[scope.source];
    case "categorie":
      return names.categories.get(scope.category_id) ?? "Categorie";
    case "magazin":
      return names.retailers.get(scope.retailer_id) ?? "Magazin";
  }
}

type ScopeKind = BudgetScope["kind"];

function BudgetScreen() {
  const { run, busy } = useAction();
  const today = toISODate(now());
  const [month, setMonth] = useState(startOfMonth(today));
  const [split, setSplit] = useState<"categorii" | "magazine">("categorii");
  const [editing, setEditing] = useState<Budget | "nou" | null>(null);
  const [fName, setFName] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fPeriod, setFPeriod] = useState<BudgetPeriod>("lunar");
  const [fKind, setFKind] = useState<ScopeKind>("total");
  const [fValue, setFValue] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const data = useData(async (ctx) => {
    const [spend, budgets, categories, retailers, lists, prices] = await Promise.all([
      spendRecords(ctx.db, ctx.householdId),
      owned(ctx.db, "budgets", ctx.householdId),
      visible(ctx.db, "product_categories", ctx.householdId),
      visible(ctx.db, "retailers", ctx.householdId),
      owned(ctx.db, "shopping_lists", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
    ]);
    const open = await Promise.all(lists.filter((l) => !l.archived_at).map(async (l) => listTotals(await listItems(ctx.db, l.id), prices)));
    return {
      spend,
      budgets: budgets.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      categories: categories.sort((a, b) => a.sort_order - b.sort_order),
      retailers: retailers.sort((a, b) => a.name.localeCompare(b.name, "ro")),
      openEstimate: sumMoney(open.map((t) => t.remaining_estimate)),
      openUnknown: open.reduce((n, t) => n + t.remaining_unknown_count, 0),
      // Produsele din „Diverse” ale cumpărăturilor încheiate, de mutat (.tasks/016).
      diverse: (await diverseToSort(ctx)).length,
    };
  });

  const view = useMemo(() => {
    if (!data) return null;
    const catMap = new Map(data.categories.map((c) => [c.id, c]));
    const retMap = new Map(data.retailers.map((r) => [r.id, r]));
    const period = monthPeriod(month);
    const monthSpend = spendInPeriod(data.spend, period);
    const total = sumAmounts(monthSpend);
    const statuses = data.budgets.filter((b) => b.active).map((b) => budgetStatus(b, data.spend, catMap, today));
    return {
      catMap,
      retMap,
      total,
      monthSpend,
      statuses,
      months: monthlyTotals(data.spend, period.to > today ? today : period.to, 6).map((m) => ({
        key: m.period.from,
        label: MONTHS_SHORT[Number(m.period.from.slice(5, 7)) - 1],
        value: m.amount,
        current: m.period.from === month,
      })),
      weeks: weeklyTotals(data.spend, today, 8).map((w) => ({ key: w.period.from, label: formatShortDate(w.period.from).replace(/\.$/, ""), value: w.amount, current: w.period.to >= today })),
      split:
        split === "categorii"
          ? byCategory(monthSpend, catMap).map((b) => ({ key: b.key, label: b.label, value: b.amount }))
          : byRetailer(monthSpend, retMap).map((b) => ({ key: b.key, label: b.label, value: b.amount })),
      sources: (["supermarket", "piata", "producator", "alta"] as PurchaseSource[])
        .map((s) => ({ source: s, amount: sumAmounts(monthSpend.filter((i) => i.source === s)) }))
        .filter((x) => x.amount > 0),
      avgTrip: averageTrip(monthSpend.filter((i) => !i.transaction_id.startsWith("in-curs"))),
      noAmount: monthSpend.filter((i) => i.amount == null).length,
    };
  }, [data, month, split, today]);

  if (!data || !view) return <Spinner />;
  const names = { categories: new Map(data.categories.map((c) => [c.id, c.name])), retailers: new Map(data.retailers.map((r) => [r.id, r.name])) };
  const mainStatus = view.statuses.find((s) => s.budget.period === "lunar" && (s.budget.scope.kind === "total" || s.budget.scope.kind === "alimente")) ?? view.statuses[0];
  const isCurrentMonth = month === startOfMonth(today);

  function openForm(b: Budget | "nou") {
    setEditing(b);
    setFormError(null);
    if (b === "nou") {
      setFName(data!.budgets.length === 0 ? "Bugetul lunii" : "");
      setFAmount("");
      setFPeriod("lunar");
      setFKind("total");
      setFValue("");
    } else {
      setFName(b.name);
      setFAmount(b.amount.toFixed(2).replace(".", ","));
      setFPeriod(b.period);
      setFKind(b.scope.kind);
      setFValue(b.scope.kind === "sursa" ? b.scope.source : b.scope.kind === "categorie" ? b.scope.category_id : b.scope.kind === "magazin" ? b.scope.retailer_id : "");
    }
  }

  async function saveForm() {
    const amount = parseMoney(fAmount);
    if (amount == null || amount <= 0) return setFormError("Scrie suma bugetului, de exemplu 2500.");
    let scope: BudgetScope;
    if (fKind === "sursa") scope = { kind: "sursa", source: (fValue || "piata") as PurchaseSource };
    else if (fKind === "categorie") {
      if (!fValue) return setFormError("Alege categoria.");
      scope = { kind: "categorie", category_id: fValue };
    } else if (fKind === "magazin") {
      if (!fValue) return setFormError("Alege magazinul.");
      scope = { kind: "magazin", retailer_id: fValue };
    } else scope = { kind: fKind };
    const input = { name: fName || scopeLabel(scope, names), period: fPeriod, scope, amount };
    const ok = await run(async (ctx) => {
      if (editing === "nou") await createBudget(ctx, input);
      else await updateBudget(ctx, (editing as Budget).id, input);
      return true;
    }, "Bugetul a fost salvat.");
    if (ok) setEditing(null);
  }

  function exportCsv(all: boolean) {
    const items = all ? data!.spend : view!.monthSpend;
    const csv = spendToCsv(items, view!.catMap, view!.retMap);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = all ? "camara-cheltuieli.csv" : `camara-cheltuieli-${month.slice(0, 7)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <>
      <PageHeader
        title="Buget"
        subtitle="Ce plănuiești și ce cheltui de fapt"
        action={
          <Button variant="secondary" onClick={() => openForm("nou")} icon={<Plus size={18} />}>
            Buget
          </Button>
        }
      />

      {data.budgets.length === 0 ? (
        <EmptyState icon={<Wallet size={32} />} title="Setează un buget" action={<Button onClick={() => openForm("nou")}>Setează bugetul lunar</Button>}>
          Spune cât vrei să cheltui pe lună (sau pe săptămână, la piață, la un anumit magazin) și urmărești cum te încadrezi, chiar din magazin.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {view.statuses.map((s) => (
            <Card key={s.budget.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-serif text-lg font-semibold leading-snug">{s.budget.name}</p>
                  <p className="text-xs text-ink-2">
                    {scopeLabel(s.budget.scope, names)} · {s.budget.period === "lunar" ? formatMonth(s.period.from) : `${formatShortDate(s.period.from)} – ${formatShortDate(s.period.to)}`}
                  </p>
                </div>
                <IconButton label={`Modifică bugetul ${s.budget.name}`} onClick={() => openForm(s.budget)} className="-mr-2 -mt-2">
                  <Pencil size={18} />
                </IconButton>
              </div>
              <div className="mt-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <span className={`text-[26px] font-medium leading-none tracking-tight ${s.over ? "text-accent" : "text-ink"}`}>{formatRon(s.spent)}</span>
                <span className="whitespace-nowrap text-sm text-ink-2">din {formatRon(s.budget.amount)}</span>
              </div>
              <div className="mt-2">
                {s === mainStatus && data.openEstimate > 0 ? (
                  <>
                    <DualBudgetBar spent={s.spent} pending={data.openEstimate} total={s.budget.amount} label={`${s.budget.name}: cheltuit și coșul de acum`} />
                    <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2 tabular">
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-brand" /> Cheltuit {formatRon(s.spent)}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-warn" /> În coș, estimat {formatRon(data.openEstimate)}
                      </span>
                    </p>
                  </>
                ) : (
                  <BudgetBar pct={s.used_pct} label={`${s.budget.name}: ${s.used_pct}% folosit`} />
                )}
              </div>
              <p className={`mt-2 text-sm ${s.over ? "font-medium text-accent" : "text-ink-2"}`}>
                {s.over ? `Ai depășit bugetul cu ${formatRon(-s.remaining)}.` : `Mai ai ${formatRon(s.remaining)}.`}
                {s.projected != null && ` La ritmul actual ajungi la ${formatRon(s.projected)} la final de lună.`}
              </p>
              {s.items_without_amount > 0 && <p className="mt-1 text-xs text-warn">{s.items_without_amount === 1 ? "Un produs cumpărat nu are preț" : `${count(s.items_without_amount, "produs", "produse")} cumpărate nu au preț`}: cheltuiala reală e mai mare.</p>}
            </Card>
          ))}
        </div>
      )}

      {data.openEstimate > 0 || data.openUnknown > 0 ? (
        // Toată caseta duce la liste (decizia proprietarului, 18 oct. 2026).
        <Link href="/cumparaturi/" className="mt-3 flex items-center gap-3 rounded-lg border border-line bg-surface p-4 transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2">
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wider text-ink-2">Înainte de cumpărături</span>
            <span className="mt-1 block text-[15px]">
              {data.openEstimate > 0 ? (
                <>
                  Listele deschise mai au de cumpărat produse de aproximativ <strong className="font-medium">{formatRon(data.openEstimate)}</strong>
                  {data.openUnknown > 0 && <> și {count(data.openUnknown, "produs", "produse")} cu preț necunoscut</>}.
                </>
              ) : (
                <>Listele deschise au {count(data.openUnknown, "produs", "produse")} fără preț cunoscut, deci nu pot estima cât vor costa. Prețurile apar după primele cumpărături.</>
              )}
              {mainStatus && data.openEstimate > 0 && (
                <>
                  {" "}
                  {mainStatus.remaining - data.openEstimate >= 0 ? (
                    <span className="text-brand">După ele, rămân {formatRon(mainStatus.remaining - data.openEstimate)} din buget.</span>
                  ) : (
                    <span className="font-medium text-accent">Depășesc bugetul cu {formatRon(data.openEstimate - mainStatus.remaining)}.</span>
                  )}
                </>
              )}
            </span>
          </span>
          <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-ink-3" />
        </Link>
      ) : null}

      <div className="mb-2 mt-8 flex items-center justify-between">
        <IconButton label="Luna anterioară" onClick={() => setMonth(startOfMonth(addDays(month, -1)))} className="border border-line bg-surface-2">
          <ChevronLeft size={20} />
        </IconButton>
        <h2 className="font-serif text-xl font-semibold">{capitalizeFirst(formatMonth(month))}</h2>
        <IconButton label="Luna următoare" disabled={isCurrentMonth} onClick={() => setMonth(startOfMonth(addDays(month, 32)))} className="border border-line bg-surface-2">
          <ChevronRight size={20} />
        </IconButton>
      </div>

      <Card className="grid grid-cols-2 divide-x divide-line">
        <div className="p-3">
          <p className="text-xs text-ink-2">Cheltuit în lună</p>
          <p className="mt-0.5 text-xl font-medium">{formatRon(view.total)}</p>
        </div>
        <div className="p-3">
          <p className="text-xs text-ink-2">Media unei ieșiri la cumpărături</p>
          <p className="mt-0.5 text-xl font-medium">{view.avgTrip == null ? "—" : formatRon(view.avgTrip)}</p>
        </div>
      </Card>
      {view.sources.length > 0 && (
        <p className="mt-2 text-sm text-ink-2 tabular">
          {view.sources.map((s) => `${s.source === "producator" ? "Producători" : SOURCE_LABELS[s.source]}: ${formatRon(s.amount)}`).join(" · ")}
        </p>
      )}

      <SectionTitle>Ultimele 6 luni</SectionTitle>
      <Card className="p-4">
        <ColumnChart bars={view.months} title="Cheltuieli pe lună" reference={mainStatus?.budget.period === "lunar" ? { value: mainStatus.budget.amount, label: "buget" } : undefined} />
      </Card>

      <SectionTitle>Ultimele 8 săptămâni</SectionTitle>
      <Card className="p-4">
        <ColumnChart bars={view.weeks} title="Cheltuieli pe săptămână" />
      </Card>

      <SectionTitle
        action={
          <div className="w-52">
            <Segmented
              label="Împarte după"
              value={split}
              onChange={setSplit}
              options={[
                { value: "categorii", label: "Categorii" },
                { value: "magazine", label: "Magazine" },
              ]}
            />
          </div>
        }
      >
        Unde s-au dus banii
      </SectionTitle>
      <Card className="p-4">
        {view.split.length === 0 ? <p className="text-sm text-ink-2">Nicio cheltuială în {formatMonth(month)}.</p> : <BarList bars={view.split} total={view.total} />}
        {view.noAmount > 0 && <p className="mt-3 text-xs text-ink-2">{view.noAmount === 1 ? "Un produs fără preț nu apare" : `${view.noAmount} produse fără preț nu apar`} în împărțire.</p>}
      </Card>
      {data.diverse > 0 && (
        <Link href="/buget/diverse/" className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line font-medium transition duration-150 ease-out hover:bg-surface-2 active:scale-[0.99]">
          <Shapes size={18} /> Mută din Diverse ({data.diverse})
        </Link>
      )}

      {/* Fără flex-1 în coloană: butoanele își păstrează înălțimea de 44 px. */}
      <div className="mt-6 grid grid-cols-2 gap-2">
        <Link href="/buget/preturi/" className="col-span-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 font-medium transition duration-150 ease-out hover:border-ink-3 active:scale-[0.99]">
          <Tags size={18} /> Prețuri și comparații
        </Link>
        <Button variant="secondary" block className="px-2" icon={<Download size={18} />} onClick={() => exportCsv(false)} disabled={view.monthSpend.length === 0}>
          Exportă luna
        </Button>
        <Button variant="secondary" block className="px-2" icon={<Download size={18} />} onClick={() => exportCsv(true)} disabled={data.spend.length === 0}>
          Exportă tot
        </Button>
      </div>

      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "nou" ? "Buget nou" : "Modifică bugetul"}
        footer={
          <div className="flex gap-2">
            {editing && editing !== "nou" && (
              <Button
                variant="danger"
                icon={<Trash2 size={18} />}
                onClick={async () => {
                  await run((ctx) => deleteBudget(ctx, (editing as Budget).id), "Bugetul a fost șters.");
                  setEditing(null);
                }}
              >
                Șterge
              </Button>
            )}
            <Button block onClick={saveForm} disabled={busy}>
              Salvează
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <LabeledInput label="Suma (lei)" inputMode="decimal" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="ex. 2500" autoFocus error={formError} />
          <Segmented<BudgetPeriod>
            label="Perioada"
            value={fPeriod}
            onChange={setFPeriod}
            options={[
              { value: "lunar", label: "Pe lună" },
              { value: "saptamanal", label: "Pe săptămână" },
            ]}
          />
          <LabeledSelect
            label="Pentru"
            value={fKind}
            onChange={(e) => {
              setFKind(e.target.value as ScopeKind);
              setFValue("");
            }}
          >
            <option value="total">Toate cumpărăturile</option>
            <option value="alimente">Doar alimente</option>
            <option value="nealimentare">Casă și igienă (nealimentare)</option>
            <option value="sursa">Supermarket sau piață</option>
            <option value="categorie">O categorie</option>
            <option value="magazin">Un magazin</option>
          </LabeledSelect>
          {fKind === "sursa" && (
            <LabeledSelect label="Sursa" value={fValue || "piata"} onChange={(e) => setFValue(e.target.value)}>
              <option value="supermarket">Supermarket</option>
              <option value="piata">Piață și producători locali</option>
              <option value="alta">Altă sursă</option>
            </LabeledSelect>
          )}
          {fKind === "categorie" && (
            <LabeledSelect label="Categoria" value={fValue} onChange={(e) => setFValue(e.target.value)}>
              <option value="">Alege…</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </LabeledSelect>
          )}
          {fKind === "magazin" && (
            <LabeledSelect label="Magazinul" value={fValue} onChange={(e) => setFValue(e.target.value)}>
              <option value="">Alege…</option>
              {data.retailers.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </LabeledSelect>
          )}
          <LabeledInput label="Nume (opțional)" value={fName} onChange={(e) => setFName(e.target.value)} maxLength={60} placeholder="ex. Piața din weekend" />
          <p className="text-xs text-ink-2">Bugetul e suma planificată. Cheltuiala reală vine doar din produsele bifate la cumpărături, cu prețul plătit.</p>
        </div>
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <BudgetScreen />
    </AppShell>
  );
}
