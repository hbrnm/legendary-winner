"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowLeft, Check, Copy, MoreHorizontal, Pencil, Repeat, Scale, Store, Trash2, LayoutList } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch, type PickedProduct } from "@/components/shopping/product-search";
import { ItemSheet } from "@/components/shopping/item-sheet";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, BudgetBar, EmptyState, Spinner } from "@/components/ui/misc";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { LabeledInput, Segmented, Toggle } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { listItems, owned, priceIndex, spendRecords, visible } from "@/lib/services/queries";
import * as shop from "@/lib/services/shopping";
import { compareRetailers, estimateFlag, groupByCategory, lineEstimate, listTotals } from "@/lib/domain/shopping";
import { budgetStatus, SOURCE_LABELS } from "@/lib/domain/budget";
import { formatQuantity } from "@/lib/domain/units";
import { formatRon } from "@/lib/domain/money";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { Retailer, ShoppingListItem } from "@/lib/domain/types";
import type { PriceIndex } from "@/lib/domain/pricing";

function ListScreen() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const toast = useToast();
  const { run } = useAction();
  const [groupBy, setGroupBy] = useState<"raioane" | "magazine">("raioane");
  const [editing, setEditing] = useState<{ id: string; focusPrice: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [addToPantry, setAddToPantry] = useState(true);
  const [hideChecked, setHideChecked] = useState(false);

  const data = useData(
    async (ctx) => {
      const list = await ctx.db.shopping_lists.get(id);
      if (!list || list.deleted_at || list.household_id !== ctx.householdId) return { list: null } as const;
      const [items, categories, retailers, prices, lists, budgets, spend, settings] = await Promise.all([
        listItems(ctx.db, id),
        visible(ctx.db, "product_categories", ctx.householdId),
        visible(ctx.db, "retailers", ctx.householdId),
        priceIndex(ctx.db, ctx.householdId),
        owned(ctx.db, "shopping_lists", ctx.householdId),
        owned(ctx.db, "budgets", ctx.householdId),
        spendRecords(ctx.db, ctx.householdId),
        ctx.db.household_settings.get(ctx.householdId),
      ]);
      const mainBudget = budgets.find((b) => b.active && b.period === "lunar" && (b.scope.kind === "total" || b.scope.kind === "alimente")) ?? budgets.find((b) => b.active && b.scope.kind === "total");
      const catMap = new Map(categories.map((c) => [c.id, c]));
      const budget = mainBudget ? budgetStatus(mainBudget, spend, catMap, toISODate(now())) : null;
      return {
        list,
        items,
        categories: categories.sort((a, b) => a.sort_order - b.sort_order),
        retailers: retailers.sort((a, b) => a.name.localeCompare(b.name, "ro")),
        prices,
        otherLists: lists.filter((l) => l.id !== id && !l.archived_at),
        budget,
        pantrySetting: settings?.pantry_on_purchase ?? "intreaba",
      };
    },
    [id],
  );

  const today = toISODate(now());
  const totals = useMemo(() => (data?.list ? listTotals(data.items, data.prices, today) : null), [data, today]);

  const groups = useMemo(() => {
    if (!data?.list) return [];
    const visibleItems = hideChecked ? data.items.filter((i) => !i.checked) : data.items;
    if (groupBy === "raioane") return groupByCategory(visibleItems, data.categories).map((g) => ({ key: g.category?.id ?? "_", title: g.category?.name ?? "Altele", items: g.items }));
    const retailers = new Map(data.retailers.map((r) => [r.id, r]));
    const map = new Map<string, ShoppingListItem[]>();
    for (const i of visibleItems) {
      const k = i.retailer_id ?? `sursa:${i.source}`;
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()]
      .map(([k, items]) => ({
        key: k,
        title: retailers.get(k)?.name ?? (k.startsWith("sursa:") ? (k === "sursa:supermarket" ? "Oriunde" : SOURCE_LABELS[k.slice(6) as keyof typeof SOURCE_LABELS]) : "Altele"),
        items: groupByCategory(items, data.categories).flatMap((g) => g.items),
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "ro"));
  }, [data, groupBy, hideChecked]);

  if (!data) return <Spinner />;
  if (!data.list) {
    return (
      <EmptyState title="Lista nu mai există" action={<Button onClick={() => router.push("/cumparaturi/")}>Înapoi la liste</Button>}>
        Poate a fost ștearsă de alt membru al gospodăriei.
      </EmptyState>
    );
  }
  const list = data.list;
  const editingItem = editing ? (data.items.find((i) => i.id === editing.id) ?? null) : null;

  async function onPick({ product, parsed }: PickedProduct) {
    await run((ctx) => shop.addItem(ctx, id, { product_id: product?.id ?? null, name: product ? undefined : parsed.text, quantity: parsed.quantity, unit: parsed.unit }));
  }

  async function toggle(item: ShoppingListItem) {
    await run((ctx) => shop.setChecked(ctx, item.id, !item.checked));
  }

  const remainingBudget = data.budget ? data.budget.remaining - (totals?.remaining_estimate ?? 0) : null;

  return (
    <>
      <div className="mb-3 flex items-center gap-1">
        <Link href="/cumparaturi/" aria-label="Înapoi la liste" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight">{list.name}</h1>
          <p className="text-xs text-ink-2">
            {totals?.checked_count ?? 0} din {totals?.item_count ?? 0} luate
            {list.is_recurring && " · listă recurentă"}
            {list.archived_at && " · arhivată"}
          </p>
        </div>
        <IconButton label="Opțiunile listei" onClick={() => setMenu(true)}>
          <MoreHorizontal size={20} />
        </IconButton>
      </div>

      {!list.archived_at && (
        <div className="sticky top-14 z-20 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur">
          <ProductSearch onPick={onPick} />
        </div>
      )}

      <div className="mb-3 flex items-center gap-2">
        <div className="flex-1">
          <Segmented
            label="Grupare"
            value={groupBy}
            onChange={setGroupBy}
            options={[
              { value: "raioane", label: "Pe raioane" },
              { value: "magazine", label: "Pe magazine" },
            ]}
          />
        </div>
        <Button variant={hideChecked ? "primary" : "secondary"} size="sm" onClick={() => setHideChecked((v) => !v)} aria-pressed={hideChecked}>
          {hideChecked ? "Arată tot" : "Ascunde luate"}
        </Button>
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={<LayoutList size={32} />} title="Lista e goală">
          Scrie mai sus ce ai de cumpărat, de exemplu „2 kg cartofi” sau „lapte”. Poți adăuga și din rețete sau din planul meselor.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.title}>
              <h2 className="mb-1.5 px-1 text-[13px] font-semibold uppercase tracking-wide text-ink-2">{g.title}</h2>
              <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
                {g.items.map((item) => {
                  const est = lineEstimate(item, data.prices, today);
                  const flag = estimateFlag(est);
                  return (
                    <li key={item.id} className="flex items-stretch border-b border-line last:border-b-0">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.checked}
                        aria-label={`${item.checked ? "Debifează" : "Bifează"} ${item.name}`}
                        onClick={() => toggle(item)}
                        className="flex w-14 shrink-0 items-center justify-center"
                      >
                        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors ${item.checked ? "border-brand bg-brand text-brand-ink" : "border-line"}`}>
                          {item.checked && <Check size={16} strokeWidth={3} />}
                        </span>
                      </button>
                      <button type="button" onClick={() => setEditing({ id: item.id, focusPrice: false })} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 pr-2 text-left">
                        <span className={`text-[15px] leading-tight ${item.checked ? "text-ink-3 line-through" : "text-ink"}`}>
                          {item.name}
                          {item.priority === "ridicata" && !item.checked && (
                            <Badge tone="accent" className="ml-2 align-middle">
                              important
                            </Badge>
                          )}
                        </span>
                        <span className="mt-0.5 truncate text-xs text-ink-2">
                          {[formatQuantity(item.quantity, item.unit), item.note, item.source !== "supermarket" ? SOURCE_LABELS[item.source] : null].filter(Boolean).join(" · ")}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing({ id: item.id, focusPrice: true })}
                        aria-label={`Prețul pentru ${item.name}`}
                        className="flex w-24 shrink-0 flex-col items-end justify-center pr-4 text-right tabular"
                      >
                        {item.actual_price != null ? (
                          <span className="text-[15px] font-medium text-ink">{formatRon(item.actual_price)}</span>
                        ) : est.amount != null ? (
                          <>
                            <span className="text-sm text-ink-2">~{formatRon(est.amount)}</span>
                            {flag && <span className="text-[11px] leading-tight text-ink-3">{flag}</span>}
                          </>
                        ) : (
                          <span className="text-xs text-ink-3">{item.checked ? "+ preț" : "fără preț"}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {totals && totals.item_count > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1 tabular">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-lg font-semibold">{formatRon(totals.spent)}</span>
                <span className="text-xs text-ink-2">cheltuit{totals.projected_total > totals.spent ? ` · estimat total ${formatRon(totals.projected_total)}` : ""}</span>
              </div>
              <div className="text-xs text-ink-2">
                {totals.unknown_price_count > 0 && <span>{totals.unknown_price_count} fără preț cunoscut · </span>}
                {remainingBudget != null ? (
                  <span className={remainingBudget < 0 ? "font-medium text-accent" : ""}>
                    {remainingBudget < 0 ? `Depășește bugetul cu ${formatRon(-remainingBudget)}` : `Rămân ${formatRon(remainingBudget)} din buget`}
                  </span>
                ) : (
                  <Link href="/buget/" className="underline underline-offset-2">
                    Setează un buget
                  </Link>
                )}
              </div>
              {data.budget && (
                <div className="mt-1.5">
                  <BudgetBar pct={((data.budget.spent + totals.remaining_estimate) / data.budget.budget.amount) * 100} label="Bugetul lunii, cu lista inclusă" />
                </div>
              )}
            </div>
            {!list.archived_at && (
              <Button onClick={() => setFinishing(true)} disabled={totals.checked_count === 0}>
                Gata
              </Button>
            )}
          </div>
        </div>
      )}

      <ItemSheet
        item={editingItem}
        estimate={editingItem ? lineEstimate(editingItem, data.prices, today) : null}
        categories={data.categories}
        retailers={data.retailers}
        lists={data.otherLists}
        focusPrice={editing?.focusPrice}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          const item = editingItem!;
          await run(async (ctx) => {
            const { actual_price, ...rest } = patch;
            await shop.updateItem(ctx, item.id, rest);
            if (actual_price !== item.actual_price) await shop.setActualPrice(ctx, item.id, actual_price ?? null);
          });
          setEditing(null);
        }}
        onMove={async (to) => {
          await run((ctx) => shop.moveItem(ctx, editingItem!.id, to), "Produsul a fost mutat.");
          setEditing(null);
        }}
        onDelete={async () => {
          const item = editingItem!;
          setEditing(null);
          await run((ctx) => shop.deleteItem(ctx, item.id));
          toast(`„${item.name}” a fost scos din listă.`, {
            action: {
              label: "Anulează",
              run: () => void run((ctx) => shop.restoreItem(ctx, item.id)),
            },
          });
        }}
      />

      <Sheet open={menu} onClose={() => setMenu(false)} title="Opțiunile listei">
        <div className="flex flex-col">
          {[
            {
              icon: Pencil,
              label: "Redenumește",
              run: () => {
                setNewName(list.name);
                setRenaming(true);
              },
            },
            { icon: Scale, label: "Compară magazinele", run: () => setComparing(true) },
            { icon: Repeat, label: list.is_recurring ? "Nu mai e recurentă" : "Fă-o recurentă (se refolosește săptămânal)", run: () => run((ctx) => shop.updateList(ctx, id, { is_recurring: !list.is_recurring })) },
            {
              icon: Copy,
              label: "Duplică lista",
              run: async () => {
                const copy = await run((ctx) => shop.duplicateList(ctx, id), "Lista a fost duplicată.");
                if (copy) router.push(`/cumparaturi/lista/?id=${copy}`);
              },
            },
            list.archived_at
              ? { icon: Archive, label: "Scoate din arhivă", run: () => run((ctx) => shop.restoreList(ctx, id), "Lista e din nou activă.") }
              : { icon: Archive, label: "Arhivează", run: () => run((ctx) => shop.archiveList(ctx, id), "Lista a fost arhivată.") },
            { icon: Trash2, label: "Șterge lista", run: () => setConfirmDelete(true), danger: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => {
                setMenu(false);
                void o.run();
              }}
              className={`flex min-h-12 items-center gap-3 rounded-xl px-2 text-left text-[15px] hover:bg-surface-2 ${"danger" in o && o.danger ? "text-accent" : "text-ink"}`}
            >
              <o.icon size={20} />
              {o.label}
            </button>
          ))}
          <div className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-sm text-ink-2">
            <Store size={16} /> Poți alege magazinul fiecărui produs din fereastra lui; apoi grupează „Pe magazine”.
          </div>
        </div>
      </Sheet>

      <Sheet open={comparing} onClose={() => setComparing(false)} title="Cât ar costa lista">
        <CompareStores items={data.items} prices={data.prices} retailers={data.retailers} today={today} />
      </Sheet>

      <Sheet
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Redenumește lista"
        footer={
          <Button
            block
            onClick={async () => {
              await run((ctx) => shop.updateList(ctx, id, { name: newName }));
              setRenaming(false);
            }}
          >
            Salvează
          </Button>
        }
      >
        <LabeledInput label="Numele listei" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} autoFocus />
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Ștergi lista?"
        message={
          <>
            Lista „{list.name}” va dispărea pentru toți membrii gospodăriei. Cumpărăturile deja finalizate rămân în istoric și în buget.
          </>
        }
        confirmLabel="Șterge"
        onConfirm={async () => {
          await run((ctx) => shop.deleteList(ctx, id), "Lista a fost ștearsă.");
          router.push("/cumparaturi/");
        }}
      />

      <Sheet
        open={finishing}
        onClose={() => setFinishing(false)}
        title="Ai terminat cumpărăturile?"
        footer={
          <Button
            block
            onClick={async () => {
              const r = await run((ctx) => shop.finalizeShopping(ctx, id, { addToPantry: data.pantrySetting === "mereu" || (data.pantrySetting === "intreaba" && addToPantry) }));
              setFinishing(false);
              if (r) {
                toast(`Gata! Ai cheltuit ${formatRon(r.total)}${r.added_to_pantry ? `; ${r.added_to_pantry} produse au intrat în cămară` : ""}.`);
                if (!list.is_recurring) router.push("/cumparaturi/");
              }
            }}
          >
            Finalizează
          </Button>
        }
      >
        {totals && (
          <div className="flex flex-col gap-3 text-[15px]">
            <p>
              Ai luat <strong>{totals.checked_count}</strong> {totals.checked_count === 1 ? "produs" : "produse"} și ai plătit <strong className="tabular">{formatRon(totals.spent)}</strong>.
            </p>
            {totals.checked_without_price_count > 0 && (
              <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
                {totals.checked_without_price_count} {totals.checked_without_price_count === 1 ? "produs bifat nu are" : "produse bifate nu au"} preț. Le poți completa acum, ca bugetul să fie exact, sau mai târziu din istoric.
              </p>
            )}
            {totals.item_count - totals.checked_count > 0 && (
              <p className="text-sm text-ink-2">
                {totals.item_count - totals.checked_count} {totals.item_count - totals.checked_count === 1 ? "produs a rămas nebifat" : "produse au rămas nebifate"}
                {list.is_recurring ? " și rămân pe listă pentru data viitoare." : ". Lista se arhivează; le poți muta înainte în altă listă."}
              </p>
            )}
            {data.pantrySetting === "intreaba" && (
              <Toggle checked={addToPantry} onChange={setAddToPantry} label="Pune alimentele în cămară" description="Le poți scădea apoi când gătești." />
            )}
            <p className="text-sm text-ink-2">
              {list.is_recurring ? "Lista recurentă se golește de bifări și e gata pentru data viitoare." : "Lista se arhivează. Cheltuielile apar în Buget."}
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <ListScreen />
      </Suspense>
    </AppShell>
  );
}

function CompareStores({ items, prices, retailers, today }: { items: ShoppingListItem[]; prices: PriceIndex; retailers: Retailer[]; today: string }) {
  const rows = compareRetailers(items, prices, today);
  if (rows.length === 0) {
    return <p className="text-[15px] text-ink-2">Nu ai încă prețuri pe magazine pentru produsele din listă. Ele apar după cumpărături sau din Buget → Prețuri.</p>;
  }
  const names = new Map(retailers.map((r) => [r.id, r.name]));
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-2">Doar prețurile văzute sau plătite la fiecare magazin. Produsele fără preț acolo nu intră în total.</p>
      <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
        {rows.map((r) => (
          <li key={r.retailer_id} className="flex min-h-14 flex-col justify-center border-b border-line px-4 py-2 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] text-ink">{names.get(r.retailer_id) ?? r.retailer_id}</span>
              <span className="text-[15px] font-medium tabular text-ink">~{formatRon(r.total)}</span>
            </div>
            <span className="text-xs text-ink-2">
              {[
                `${r.priced_count} din ${r.item_count} produse ${r.priced_count === 1 ? "are" : "au"} preț aici`,
                r.promo_count > 0 && `${r.promo_count} la promoție`,
                r.stale_count > 0 && `${r.stale_count} ${r.stale_count === 1 ? "preț vechi" : "prețuri vechi"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
