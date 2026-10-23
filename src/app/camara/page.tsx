"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Minus, Plus, Search, ShoppingBasket, Trash2, Warehouse } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { Button, IconButton } from "@/components/ui/button";
import { Chip, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Field, Input, LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { owned, visible } from "@/lib/services/queries";
import { addPantryItem, adjustPantry, removePantryItem, updatePantryItem } from "@/lib/services/kitchen";
import { addItem, createList } from "@/lib/services/shopping";
import { expiringSoon, expiryState } from "@/lib/domain/pantry";
import { recipesUsingProducts } from "@/lib/domain/recipes";
import { addDays, daysBetween, formatShortDate, toISODate } from "@/lib/domain/dates";
import { formatQuantity, SHOPPING_UNITS, unitLabel } from "@/lib/domain/units";
import { normalize } from "@/lib/domain/search";
import { now } from "@/lib/clock";
import type { PantryItem, Product, UnitCode } from "@/lib/domain/types";

const STEP: Partial<Record<UnitCode, number>> = { kg: 0.25, g: 100, l: 0.25, ml: 100 };

/** Termenul ca o ștampilă, ca pe Acasă (decizia proprietarului, 18 oct. 2026). */
const STAMP = "text-xs font-medium uppercase tracking-wider text-accent";

function expiryBadge(item: PantryItem, today: string) {
  const s = expiryState(item, today);
  if (s === "expirat") return <span className={STAMP}>expirat</span>;
  if (s === "expira_curand") {
    const d = daysBetween(today, item.expires_on!);
    return (
      <span className={STAMP}>
        <span className="sr-only">expiră </span>
        {d === 0 ? "azi" : d === 1 ? "mâine" : `în ${d} zile`}
      </span>
    );
  }
  if (s === "ok") return <span className="text-xs text-ink-2">până pe <span>{formatShortDate(item.expires_on!)}</span></span>;
  return null;
}

const MAIN_LOCATIONS = new Set(["frigider", "congelator", "camara"]);

function LocationFilter({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-11 min-w-0 rounded-lg border px-1 text-[13px] font-medium transition-colors ${active ? "border-brand bg-brand text-brand-ink" : "border-line bg-surface text-ink-2 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

interface Draft {
  id: string | null;
  product_id: string | null;
  name: string;
  quantity: string;
  unit: UnitCode;
  location_id: string;
  expires_on: string;
  purchased_on: string;
  note: string;
  /** Ziua de „consumat” (.tasks/016); goală la produsele adăugate de mână. */
  auto_consume_on: string;
  /** Avea zi de „consumat” la deschidere: golirea ei se salvează. */
  had_auto: boolean;
}

function PantryScreen() {
  const toast = useToast();
  const { run, busy } = useAction();
  const today = toISODate(now());
  const [location, setLocation] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);

  const data = useData(async (ctx) => {
    const [items, locations, recipes, ingredients, lists] = await Promise.all([
      owned(ctx.db, "pantry_items", ctx.householdId),
      visible(ctx.db, "pantry_locations", ctx.householdId),
      visible(ctx.db, "recipes", ctx.householdId),
      visible(ctx.db, "recipe_ingredients", ctx.householdId),
      owned(ctx.db, "shopping_lists", ctx.householdId),
    ]);
    const soon = expiringSoon(items, today, 3);
    const soonProducts = new Set(soon.filter((i) => i.product_id).map((i) => i.product_id!));
    return {
      items: items.sort((a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999") || a.name.localeCompare(b.name, "ro")),
      locations: locations.sort((a, b) => a.sort_order - b.sort_order),
      soon,
      useSoon: recipesUsingProducts(recipes, ingredients, soonProducts).slice(0, 4),
      lists: lists.filter((l) => !l.archived_at),
    };
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = normalize(query);
    return data.items.filter((i) => (showEmpty || i.quantity > 0) && (!location || i.location_id === location) && (!q || normalize(i.name).includes(q)));
  }, [data, location, query, showEmpty]);

  if (!data) return <Spinner />;
  const locName = new Map(data.locations.map((l) => [l.id, l.name]));
  const emptyCount = data.items.filter((i) => i.quantity <= 0).length;

  function startAdd(product: Product | null, text: string, quantity: number | null, unit: UnitCode | null) {
    const cold = product && ["lactate", "branzeturi", "carne", "peste", "mezeluri", "oua"].includes(product.category_id);
    setDraft({
      id: null,
      product_id: product?.id ?? null,
      name: product?.name ?? text,
      quantity: String(quantity ?? 1).replace(".", ","),
      unit: unit ?? product?.default_unit ?? "buc",
      location_id: location ?? (product?.category_id === "congelate" ? "congelator" : cold ? "frigider" : "camara"),
      expires_on: "",
      purchased_on: today,
      note: "",
      auto_consume_on: "",
      had_auto: false,
    });
  }

  function startEdit(i: PantryItem) {
    setDraft({
      id: i.id,
      product_id: i.product_id,
      name: i.name,
      quantity: String(i.quantity).replace(".", ","),
      unit: i.unit,
      location_id: i.location_id,
      expires_on: i.expires_on ?? "",
      purchased_on: i.purchased_on ?? "",
      note: i.note ?? "",
      auto_consume_on: i.auto_consume_on ?? "",
      had_auto: Boolean(i.auto_consume_on),
    });
  }

  async function saveDraft() {
    const d = draft!;
    const input = {
      product_id: d.product_id,
      name: d.name,
      quantity: Number(d.quantity.replace(",", ".")),
      unit: d.unit,
      location_id: d.location_id,
      expires_on: d.expires_on || null,
      purchased_on: d.purchased_on || null,
      note: d.note.trim() || null,
      ...(d.auto_consume_on || d.had_auto ? { auto_consume_on: d.auto_consume_on || null } : {}),
    };
    const ok = await run(async (ctx) => {
      if (d.id) await updatePantryItem(ctx, d.id, input);
      else await addPantryItem(ctx, input);
      return true;
    });
    if (ok) setDraft(null);
  }

  async function toShoppingList(i: PantryItem) {
    const r = await run(async (ctx) => {
      const listId = data!.lists[0]?.id ?? (await createList(ctx, { name: "Cumpărături" }));
      await addItem(ctx, listId, i.product_id ? { product_id: i.product_id } : { name: i.name, category_id: "diverse" });
      return listId;
    });
    if (r) toast(`„${i.name}” e pe lista „${data!.lists[0]?.name ?? "Cumpărături"}”.`);
  }

  return (
    <>
      <PageHeader title="Cămară și frigider" subtitle={`${data.items.filter((i) => i.quantity > 0).length} produse acasă`} />

      {data.soon.length > 0 && (
        // Etichetă de borcan: chenar punctat terracotta, ca „Expiră curând” de pe Acasă.
        <section aria-label="Expiră curând" className="mb-4 rounded-md border border-dashed border-accent bg-surface p-4">
          <p className="font-serif text-lg font-semibold text-accent">{data.soon.length === 1 ? "Un produs expiră curând" : `${data.soon.length} produse expiră curând`}</p>
          <p className="mt-1 text-sm text-ink">{data.soon.map((i) => i.name).join(", ")}</p>
          {data.useSoon.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-ink-2">{data.soon.length === 1 ? "Rețete în care intră:" : "Le poți folosi în:"}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {data.useSoon.map((r) => (
                  <Link key={r.recipe.id} href={`/retete/reteta/?id=${r.recipe.id}`} className="inline-flex min-h-11 items-center rounded-md border border-line bg-surface px-3 font-serif text-[15px] font-medium text-ink transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2">
                    {r.recipe.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <ProductSearch placeholder="Adaugă în cămară: ex. 1 kg făină" onPick={({ product, parsed }) => startAdd(product, parsed.text, parsed.quantity, parsed.unit)} />

      {/* Cele 4 filtre principale încap pe un rând de la 360 px; celelalte locuri apar dedesubt doar dacă au produse. */}
      <div role="group" aria-label="Unde caut" className="mt-3 grid grid-cols-4 gap-1.5">
        {[{ id: null, name: "Toate" }, ...data.locations.filter((l) => MAIN_LOCATIONS.has(l.id))].map((l) => (
          <LocationFilter key={l.id ?? "toate"} active={location === l.id} onClick={() => setLocation(l.id === null || location === l.id ? null : l.id)}>
            {l.name}
          </LocationFilter>
        ))}
      </div>
      {data.locations.some((l) => !MAIN_LOCATIONS.has(l.id) && data.items.some((i) => i.location_id === l.id)) && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {data.locations
            .filter((l) => !MAIN_LOCATIONS.has(l.id) && data.items.some((i) => i.location_id === l.id))
            .map((l) => (
              <Chip key={l.id} active={location === l.id} onClick={() => setLocation(location === l.id ? null : l.id)}>
                {l.name}
              </Chip>
            ))}
        </div>
      )}

      {data.items.length > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 transition-colors duration-150 ease-out focus-within:border-brand focus-within:bg-surface">
          <Search size={16} className="text-ink-3" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută în cămară" aria-label="Caută în cămară" className="h-11 min-w-0 flex-1 bg-transparent focus:outline-none" />
        </div>
      )}

      {data.items.length === 0 ? (
        <div className="mt-4">
          <EmptyState icon={<Warehouse size={32} />} title="Cămara e goală">
            Notează ce ai acasă, cu data expirării, și îți spunem ce poți găti și ce trebuie folosit repede. Produsele cumpărate pot intra aici automat când termini cumpărăturile.
          </EmptyState>
        </div>
      ) : (
        <>
          {(location ? [location] : data.locations.map((l) => l.id)).map((loc) => {
            const items = filtered.filter((i) => i.location_id === loc);
            if (items.length === 0) return null;
            return (
              <section key={loc} className="mt-5">
                <SectionTitle>{locName.get(loc) ?? "Alt loc"}</SectionTitle>
                <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                  {items.map((i) => (
                    <li key={i.id} className="flex items-center gap-2 py-1.5 pl-4 pr-2">
                      <button type="button" onClick={() => startEdit(i)} className="min-w-0 flex-1 py-1 text-left">
                        <span className={`block text-[15px] ${i.quantity <= 0 ? "text-ink-3 line-through" : ""}`}>{i.name}</span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-ink-2">
                          <span>{formatQuantity(i.quantity, i.unit)}</span>
                          {expiryBadge(i, today)}
                        </span>
                      </button>
                      <IconButton label={`Scade ${i.name}`} onClick={() => run((ctx) => adjustPantry(ctx, i.id, -(STEP[i.unit] ?? 1)))} disabled={i.quantity <= 0}>
                        <Minus size={18} />
                      </IconButton>
                      <IconButton label={`Adaugă ${i.name}`} onClick={() => run((ctx) => adjustPantry(ctx, i.id, STEP[i.unit] ?? 1))}>
                        <Plus size={18} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
          {emptyCount > 0 && (
            <Button variant="ghost" className="mt-3" onClick={() => setShowEmpty((v) => !v)}>
              {showEmpty ? "Ascunde produsele terminate" : `Arată produsele terminate (${emptyCount})`}
            </Button>
          )}
        </>
      )}

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? draft.name : "Adaugă în cămară"}
        footer={
          <div className="flex gap-2">
            {draft?.id && (
              <Button
                variant="danger"
                icon={<Trash2 size={18} />}
                aria-label="Scoate din cămară"
                onClick={async () => {
                  const id = draft.id!;
                  setDraft(null);
                  await run((ctx) => removePantryItem(ctx, id), "Produsul a fost scos din cămară.");
                }}
              />
            )}
            {draft?.id && (
              <Button
                variant="secondary"
                icon={<ShoppingBasket size={18} />}
                onClick={() => {
                  const item = data.items.find((x) => x.id === draft.id);
                  if (item) void toShoppingList(item);
                }}
              >
                În listă
              </Button>
            )}
            <Button block onClick={saveDraft} disabled={busy}>
              Salvează
            </Button>
          </div>
        }
      >
        {draft && (
          <div className="flex flex-col gap-4">
            {!draft.product_id && <LabeledInput label="Denumire" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} />}
            <Field label="Cantitate">
              <div className="flex gap-2">
                <Input inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} className="flex-1 tabular" aria-label="Cantitate" />
                <select aria-label="Unitate" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as UnitCode })} className="h-11 w-32 rounded-lg border border-line bg-surface px-3">
                  {SHOPPING_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {unitLabel(u, 2)}
                    </option>
                  ))}
                </select>
              </div>
            </Field>
            <LabeledSelect label="Unde e" value={draft.location_id} onChange={(e) => setDraft({ ...draft, location_id: e.target.value })}>
              {data.locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </LabeledSelect>
            <div className="grid grid-cols-2 gap-2">
              <LabeledInput label="Expiră pe" type="date" value={draft.expires_on} onChange={(e) => setDraft({ ...draft, expires_on: e.target.value })} />
              <LabeledInput label="Cumpărat pe" type="date" value={draft.purchased_on} onChange={(e) => setDraft({ ...draft, purchased_on: e.target.value })} />
            </div>
            {draft.id && (
              <LabeledInput
                label="Consumat până pe"
                type="date"
                value={draft.auto_consume_on}
                onChange={(e) => setDraft({ ...draft, auto_consume_on: e.target.value })}
                // De mâine încolo: o zi trecută l-ar scoate din cămară imediat.
                min={addDays(today, 1)}
                hint="Apoi îl scot singur din cămară. Golește data ca să rămână."
              />
            )}
            <LabeledInput label="Observații" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={300} placeholder="ex. deschis, de folosit în 3 zile" />
          </div>
        )}
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <PantryScreen />
    </AppShell>
  );
}
