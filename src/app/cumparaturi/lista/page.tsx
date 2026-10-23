"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Archive, ArrowLeft, ChevronDown, Copy, MoreHorizontal, Pencil, Plus, Receipt, Repeat, Scale, Store, Trash2, LayoutList } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { useApp } from "@/components/app/app-provider";
import { ProductSearch, type PickedProduct } from "@/components/shopping/product-search";
import { ItemSheet } from "@/components/shopping/item-sheet";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, BudgetBar, EmptyState, Spinner } from "@/components/ui/misc";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { LabeledInput, Segmented, Toggle } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { listItems, owned, priceIndex, spendRecords, visible } from "@/lib/services/queries";
import * as shop from "@/lib/services/shopping";
import { createVariant } from "@/lib/services/catalog";
import { variantLabel, variantsOf } from "@/lib/domain/variants";
import { compareRetailers, estimateFlag, groupByCategory, lineEstimate, listTotals, quickSuggestions } from "@/lib/domain/shopping";
import { budgetStatus, SOURCE_LABELS } from "@/lib/domain/budget";
import { formatQuantity } from "@/lib/domain/units";
import { formatRon } from "@/lib/domain/money";
import { count } from "@/lib/domain/text";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { Retailer, ShoppingListItem } from "@/lib/domain/types";
import type { PriceIndex } from "@/lib/domain/pricing";

function ListScreen() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const toast = useToast();
  const { run } = useAction();
  const { variantsEnabled } = useApp();
  const [groupBy, setGroupBy] = useState<"raioane" | "magazine">("raioane");
  const [editing, setEditing] = useState<{ id: string; focusPrice: boolean } | null>(null);
  const [menu, setMenu] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [addToPantry, setAddToPantry] = useState(true);
  // „În coș”: ce bifezi coboară aici, strâns (decizia proprietarului, 23 oct. 2026).
  const [basketOpen, setBasketOpen] = useState(false);
  // Produsul abia bifat rămâne o clipă la locul lui, cât se desenează bifa.
  const [lingering, setLingering] = useState<Set<string>>(new Set());
  const lingerTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const data = useData(
    async (ctx) => {
      const list = await ctx.db.shopping_lists.get(id);
      if (!list || list.deleted_at || list.household_id !== ctx.householdId) return { list: null } as const;
      const [items, categories, retailers, prices, lists, budgets, spend, settings, pantry, variants, brands] = await Promise.all([
        listItems(ctx.db, id),
        visible(ctx.db, "product_categories", ctx.householdId),
        visible(ctx.db, "retailers", ctx.householdId),
        priceIndex(ctx.db, ctx.householdId),
        owned(ctx.db, "shopping_lists", ctx.householdId),
        owned(ctx.db, "budgets", ctx.householdId),
        spendRecords(ctx.db, ctx.householdId),
        ctx.db.household_settings.get(ctx.householdId),
        owned(ctx.db, "pantry_items", ctx.householdId),
        visible(ctx.db, "product_variants", ctx.householdId),
        visible(ctx.db, "brands", ctx.householdId),
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
        variants,
        variantById: new Map(variants.map((v) => [v.id, v])),
        brands: new Map(brands.map((b) => [b.id, b.name])),
        suggestions: quickSuggestions({
          listProductIds: items.flatMap((i) => (i.product_id ? [i.product_id] : [])),
          pantry,
          history: spend.filter((s) => !s.id.startsWith("in-curs")),
          today: toISODate(now()),
        }),
      };
    },
    [id],
  );

  const today = toISODate(now());
  const totals = useMemo(() => (data?.list ? listTotals(data.items, data.prices, today) : null), [data, today]);

  const groups = useMemo(() => {
    if (!data?.list) return [];
    const visibleItems = data.items.filter((i) => !i.checked || lingering.has(i.id));
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
  }, [data, groupBy, lingering]);

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
  const variantText = (item: ShoppingListItem) => {
    const v = item.variant_id ? data.variantById.get(item.variant_id) : undefined;
    return v && !v.deleted_at ? variantLabel(v, v.brand_id ? data.brands.get(v.brand_id) : null) : null;
  };

  async function onPick({ product, parsed }: PickedProduct) {
    await run((ctx) => shop.addItem(ctx, id, { product_id: product?.id ?? null, name: product ? undefined : parsed.text, quantity: parsed.quantity, unit: parsed.unit }));
  }

  async function toggle(item: ShoppingListItem) {
    if (!item.checked) {
      // Pe Android, o vibrație scurtă la bifă; pe iPhone nu există.
      try {
        navigator.vibrate?.(10);
      } catch {}
      setLingering((xs) => new Set(xs).add(item.id));
      clearTimeout(lingerTimers.current.get(item.id));
      lingerTimers.current.set(
        item.id,
        setTimeout(() => {
          lingerTimers.current.delete(item.id);
          setLingering((xs) => {
            const next = new Set(xs);
            next.delete(item.id);
            return next;
          });
        }, 500),
      );
    }
    await run((ctx) => shop.setChecked(ctx, item.id, !item.checked));
  }

  async function archive() {
    if (await run(async (ctx) => (await shop.archiveList(ctx, id), true)))
      toast("Am pus-o deoparte.", { action: { label: "Anulează", run: () => void run((ctx) => shop.restoreList(ctx, id)) } });
  }

  const basket = data.items.filter((i) => i.checked && !lingering.has(i.id));
  const allIn = !list.archived_at && totals != null && totals.item_count > 0 && totals.checked_count === totals.item_count;

  const itemRow = (item: ShoppingListItem) => {
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
          <CheckMark checked={item.checked} animate={lingering.has(item.id)} />
        </button>
        <button type="button" onClick={() => setEditing({ id: item.id, focusPrice: false })} className="flex min-h-14 min-w-0 flex-1 flex-col justify-center py-2 pr-2 text-left">
          <span className={`text-[15px] leading-tight ${item.checked ? "text-ink-3 line-through" : "text-ink"}`}>
            {item.name}
            {item.priority === "ridicata" && !item.checked && (
              <Badge tone="accent" className="ml-2 align-middle">
                neapărat
              </Badge>
            )}
          </span>
          <span className="mt-0.5 truncate text-xs text-ink-2">
            {[formatQuantity(item.quantity, item.unit), variantText(item), item.note, item.source !== "supermarket" ? SOURCE_LABELS[item.source] : null].filter(Boolean).join(" · ")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setEditing({ id: item.id, focusPrice: true })}
          aria-label={`Prețul pentru ${item.name}`}
          className="flex w-24 shrink-0 flex-col items-end justify-center pr-4 text-right"
        >
          {item.actual_price != null ? (
            <span className="text-sm font-medium text-ink">{formatRon(item.actual_price)}</span>
          ) : est.amount != null ? (
            <>
              <span className="text-[13px] text-ink-2">~{formatRon(est.amount)}</span>
              {flag && <span className="font-sans text-[11px] leading-tight text-ink-3">{flag}</span>}
            </>
          ) : (
            <span className="font-sans text-xs text-ink-3">{item.checked ? "cât a costat?" : "preț?"}</span>
          )}
        </button>
      </li>
    );
  };

  const remainingBudget = data.budget ? data.budget.remaining - (totals?.remaining_estimate ?? 0) : null;

  return (
    <>
      <div className="mb-3 flex items-center gap-1">
        <Link href="/cumparaturi/" aria-label="Înapoi la liste" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="line-clamp-2 break-words text-xl font-semibold leading-snug tracking-tight">{list.name}</h1>
          <p className="text-xs text-ink-2 tabular">
            {totals?.checked_count ?? 0} din {totals?.item_count ?? 0} în coș
            {totals && totals.projected_total > 0 && ` · ~${formatRon(totals.projected_total)}`}
            {list.is_recurring && " · se reia"}
            {list.archived_at && " · pusă deoparte"}
          </p>
          {totals && totals.item_count > 0 && (
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${(totals.checked_count / totals.item_count) * 100}%` }} />
            </div>
          )}
        </div>
        <IconButton label="Opțiunile listei" onClick={() => setMenu(true)}>
          <MoreHorizontal size={20} />
        </IconButton>
      </div>

      {!list.archived_at && (
        <div className="sticky top-14 z-20 -mx-4 bg-bg px-4 pb-3 pt-1">
          <ProductSearch placeholder="Ce-ți trebuie? ex. 2 kg roșii" onPick={onPick} />
        </div>
      )}

      <div className="mb-3">
        <div>
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
      </div>

      {data.items.length === 0 ? (
        <EmptyState icon={<LayoutList size={32} />} title="Foaia e albă">
          Scrie sus ce-ți trebuie („2 kg cartofi”, „lapte”) sau ia direct dintr-o rețetă ori din planul meselor.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.title}>
              <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-ink-2">{g.title}</h2>
              <ul className="overflow-hidden rounded-lg border border-line bg-surface">
                {g.items.map(itemRow)}
              </ul>
            </section>
          ))}
          {basket.length > 0 && (
            <section aria-label="În coș">
              <button
                type="button"
                aria-expanded={basketOpen}
                onClick={() => setBasketOpen((v) => !v)}
                className="flex min-h-11 w-full items-center gap-2 px-1 text-left text-sm font-medium text-ink-2"
              >
                <span className="flex-1">În coș ({basket.length})</span>
                <ChevronDown size={18} className={`transition-transform ${basketOpen ? "rotate-180" : ""}`} />
              </button>
              {basketOpen && <ul className="overflow-hidden rounded-lg border border-line bg-surface">{basket.map(itemRow)}</ul>}
            </section>
          )}
        </div>
      )}

      {!list.archived_at && data.suggestions.length > 0 && (
        <section aria-label="Poate-ți mai trebuie" className="mt-6">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-2">Poate-ți mai trebuie</h2>
          {/* Două grupuri cu titlu, în locul sufixului de pe fiecare buton (decizia proprietarului, 18 oct. 2026). */}
          {QUICK_GROUPS.map(([reason, title]) => {
            const items = data.suggestions.filter((s) => s.reason === reason);
            if (items.length === 0) return null;
            return (
              <div key={reason} className="mt-3">
                <h3 className={`mb-1.5 px-1 text-xs ${reason === "terminat" ? "text-warn" : "text-ink-2"}`}>{title}</h3>
                <ul className="flex flex-wrap gap-2">
                  {items.map((s) => (
                    <li key={s.product_id}>
                      <button
                        type="button"
                        onClick={() => run((ctx) => shop.addItem(ctx, id, { product_id: s.product_id }))}
                        aria-label={`Adaugă ${s.name}`}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-left text-sm text-ink transition duration-150 ease-out hover:bg-surface-2 active:scale-[0.98]"
                      >
                        <Plus size={16} className="shrink-0 text-brand" />
                        <span>{s.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {/* Loc pentru bara cu totalul, fixată jos, ca ultimele rânduri să nu rămână sub ea. */}
      {totals && totals.item_count > 0 && <div aria-hidden className={allIn ? "h-28 lg:h-20" : "h-24 lg:h-16"} />}

      {totals && totals.item_count > 0 && (
        <div className="pb-safe fixed inset-x-0 bottom-16 z-30 border-t border-line bg-surface px-4 py-3 lg:bottom-0 lg:left-60">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1 tabular">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-lg font-medium">{formatRon(totals.spent)}</span>
                <span className="text-xs text-ink-2">dați până acum{totals.projected_total > totals.spent ? ` · cam ${formatRon(totals.projected_total)} în total` : ""}</span>
              </div>
              <div className="text-xs text-ink-2">
                {totals.unknown_price_count > 0 && <span>{totals.unknown_price_count} încă fără preț · </span>}
                {remainingBudget != null ? (
                  <span className={remainingBudget < 0 ? "font-medium text-accent" : ""}>
                    {remainingBudget < 0 ? `Ai trecut de buget cu ${formatRon(-remainingBudget)}` : `Mai ai ${formatRon(remainingBudget)} ${data.budget?.budget.period === "saptamanal" ? "săptămâna asta" : "luna asta"}`}
                  </span>
                ) : (
                  <Link href="/buget/" className="underline underline-offset-2">
                    Pune-ți un buget
                  </Link>
                )}
              </div>
              {allIn && <p className="mt-0.5 text-sm font-medium text-brand">Ai tot! Apasă „Gata” la casă.</p>}
              {data.budget && (
                <div className="mt-1.5">
                  <BudgetBar pct={((data.budget.spent + totals.remaining_estimate) / data.budget.budget.amount) * 100} label={data.budget.budget.period === "saptamanal" ? "Bugetul săptămânii, cu lista inclusă" : "Bugetul lunii, cu lista inclusă"} />
                </div>
              )}
            </div>
            {!list.archived_at && (
              <Button onClick={() => setFinishing(true)} disabled={totals.checked_count === 0} className={allIn ? "ring-2 ring-brand ring-offset-2 ring-offset-surface" : ""}>
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
        variants={
          variantsEnabled && editingItem?.product_id
            ? {
                list: variantsOf(data.variants, editingItem.product_id),
                brands: data.brands,
                onCreate: async (input) => (await run((ctx) => createVariant(ctx, { ...input, product_id: editingItem.product_id! }), "Am adăugat varianta.")) ?? null,
              }
            : undefined
        }
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
              label: "Schimbă numele",
              run: () => {
                setNewName(list.name);
                setRenaming(true);
              },
            },
            { icon: Scale, label: "Unde iese mai ieftin", run: () => setComparing(true) },
            { icon: Repeat, label: list.is_recurring ? "Nu o mai relua" : "Păstreaz-o pentru data viitoare", run: () => run((ctx) => shop.updateList(ctx, id, { is_recurring: !list.is_recurring })) },
            ...(list.archived_at ? [] : [{ icon: Receipt, label: "Adaugă bon", run: () => router.push(`/cumparaturi/bon/?lista=${id}`) }]),
            {
              icon: Copy,
              label: "Fă o copie",
              run: async () => {
                const copy = await run((ctx) => shop.duplicateList(ctx, id), "Gata copia.");
                if (copy) router.push(`/cumparaturi/lista/?id=${copy}`);
              },
            },
            list.archived_at
              ? { icon: Archive, label: "Scoate înapoi", run: () => run((ctx) => shop.restoreList(ctx, id), "Am scos lista înapoi.") }
              : { icon: Archive, label: "Pune deoparte", run: archive },
            { icon: Trash2, label: "Șterge lista", run: () => setConfirmDelete(true), danger: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => {
                setMenu(false);
                void o.run();
              }}
              className={`flex min-h-12 items-center gap-3 rounded-lg px-2 text-left text-[15px] hover:bg-surface-2 ${"danger" in o && o.danger ? "text-accent" : "text-ink"}`}
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
        title="Schimbă numele listei"
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
          if (!(await run(async (ctx) => (await shop.deleteList(ctx, id), true)))) return;
          toast("Am șters lista.", { action: { label: "Anulează", run: () => void run((ctx) => shop.restoreDeletedList(ctx, id)) } });
          router.push("/cumparaturi/");
        }}
      />

      <Sheet
        open={finishing}
        onClose={() => setFinishing(false)}
        title="Gata la cumpărături?"
        footer={
          <Button
            block
            onClick={async () => {
              const r = await run((ctx) => shop.finalizeShopping(ctx, id, { addToPantry: data.pantrySetting === "mereu" || (data.pantrySetting === "intreaba" && addToPantry) }));
              setFinishing(false);
              if (r) {
                toast(`Gata! Ai dat ${formatRon(r.total)}.${r.added_to_pantry ? ` Am pus ${r.added_to_pantry === 1 ? "un produs" : count(r.added_to_pantry, "produs", "produse")} în cămară.` : ""}`);
                if (!list.is_recurring) router.push("/cumparaturi/");
              }
            }}
          >
            Gata, am terminat
          </Button>
        }
      >
        {totals && (
          <div className="flex flex-col gap-3 text-[15px]">
            <p>
              Ai luat <strong>{totals.checked_count}</strong> {totals.checked_count === 1 ? "produs" : "produse"} și ai plătit <strong className="tabular">{formatRon(totals.spent)}</strong>.
            </p>
            {totals.checked_without_price_count > 0 && (
              <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">
                La {count(totals.checked_without_price_count, "produs", "produse")} n-ai pus prețul. {totals.checked_without_price_count === 1 ? "Îl pui" : "Le pui"} acum sau mai încolo, din istoric, cum îți vine.
              </p>
            )}
            {totals.item_count - totals.checked_count > 0 && (
              <p className="text-sm text-ink-2">
                {totals.item_count - totals.checked_count === 1 ? "1 produs a rămas nebifat" : `${count(totals.item_count - totals.checked_count, "produs", "produse")} au rămas nebifate`}
                {list.is_recurring
                  ? ` și ${totals.item_count - totals.checked_count === 1 ? "rămâne" : "rămân"} pe listă pentru data viitoare.`
                  : `. Pun lista deoparte; ${totals.item_count - totals.checked_count === 1 ? "îl" : "le"} poți muta înainte în altă listă.`}
              </p>
            )}
            {data.pantrySetting === "intreaba" && (
              <Toggle checked={addToPantry} onChange={setAddToPantry} label="Pune alimentele în cămară" description="Le poți scădea apoi când gătești." />
            )}
            <p className="text-sm text-ink-2">
              {list.is_recurring ? "Debifez tot și lista te așteaptă data viitoare." : "Pun lista deoparte, iar banii îi trec la Buget."}
            </p>
          </div>
        )}
      </Sheet>
    </>
  );
}

/** Grupurile din „Poate-ți mai trebuie”, în ordinea în care apar. */
const QUICK_GROUPS = [
  ["terminat", "S-a terminat în cămară"],
  ["des", "Cumperi des"],
] as const;

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
      <ul className="overflow-hidden rounded-lg border border-line bg-surface">
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

/** Bifa desenată: un cerc ca trasat de mână, care se umple, iar bifa se scrie dintr-o trăsătură. */
function CheckMark({ checked, animate }: { checked: boolean; animate: boolean }) {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7" aria-hidden>
      <path
        d="M14.2 2.6c6.3-.1 11.3 5 11.2 11.5-.1 6.3-5.3 11.4-11.6 11.3C7.4 25.3 2.5 20.2 2.6 13.8 2.7 7.6 7.9 2.7 14.2 2.6z"
        strokeWidth={2}
        className={`transition-colors duration-200 ${checked ? "fill-brand stroke-brand" : "fill-none stroke-line"}`}
      />
      {checked && <path d="M8.6 14.6l3.7 3.5 7.4-8" fill="none" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className={`stroke-brand-ink ${animate ? "draw-check" : ""}`} />}
    </svg>
  );
}
