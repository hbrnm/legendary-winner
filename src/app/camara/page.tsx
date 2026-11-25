"use client";

import { useMemo, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { AlertTriangle, BasketIcon, ChevronDown, Clock, JarIcon, Minus, MoreHorizontal, Search, Trash2 } from "@/components/ui/icons";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { AddButton, Button, IconButton } from "@/components/ui/button";
import { Badge, Chip, EmptyState, PageHeader, Spinner } from "@/components/ui/misc";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { owned, visible } from "@/lib/services/queries";
import { addPantryItem, adjustPantry, removePantryItem, removePantryItems, restorePantryItem, restorePantryItems, updatePantryItem } from "@/lib/services/kitchen";
import { addItem, createList } from "@/lib/services/shopping";
import { finishPantryToList } from "@/lib/services/pantry-exceptions";
import { expiringSoon, expiryState } from "@/lib/domain/pantry";
import { recipesUsingProducts } from "@/lib/domain/recipes";
import { addDays, daysBetween, formatShortDate, toISODate } from "@/lib/domain/dates";
import { formatQuantity, SHOPPING_UNITS, unitLabel } from "@/lib/domain/units";
import { normalize } from "@/lib/domain/search";
import { now } from "@/lib/clock";
import { isAvailableRecipe } from "@/data/recipes/visibility";
import type { PantryItem, UnitCode } from "@/lib/domain/types";

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

function PantryScreen({ captureRef }: { captureRef: Ref<HTMLDivElement> }) {
  const toast = useToast();
  const { run, busy } = useAction();
  const today = toISODate(now());
  const [expiryOnly, setExpiryOnly] = useState(false);
  const [locationFilter, setLocationFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const touchStart = useRef<{ id: string; x: number; y: number } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showEmpty, setShowEmpty] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulk, setConfirmBulk] = useState<{ open: boolean; ids: string[]; title: string; message: string }>({
    open: false,
    ids: [],
    title: "",
    message: "",
  });

  const data = useData(async (ctx) => {
    const [items, locations, recipes, ingredients, lists] = await Promise.all([
      owned(ctx.db, "pantry_items", ctx.householdId),
      visible(ctx.db, "pantry_locations", ctx.householdId),
      visible(ctx.db, "recipes", ctx.householdId),
      visible(ctx.db, "recipe_ingredients", ctx.householdId),
      owned(ctx.db, "shopping_lists", ctx.householdId),
    ]);
    const soon = expiringSoon(items, today, 3);
    const soonProducts = new Set(soon.filter((i) => i.product_id && expiryState(i, today) === "expira_curand").map((i) => i.product_id!));
    return {
      items: items.sort((a, b) => (a.expires_on ?? "9999").localeCompare(b.expires_on ?? "9999") || a.name.localeCompare(b.name, "ro")),
      locations: locations.sort((a, b) => a.sort_order - b.sort_order),
      soon,
      useSoon: recipesUsingProducts(recipes.filter(isAvailableRecipe), ingredients, soonProducts).slice(0, 4),
      lists: lists.filter((l) => !l.archived_at),
    };
  }, [today]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const q = normalize(query.trim());
    const urgentIds = new Set(data.soon.map((item) => item.id));
    return data.items.filter((i) => (showEmpty || i.quantity > 0) && (!expiryOnly || urgentIds.has(i.id)) && (!locationFilter || i.location_id === locationFilter) && (!q || normalize(i.name).includes(q)));
  }, [data, expiryOnly, locationFilter, query, showEmpty]);

  if (!data) return <Spinner />;
  const locName = new Map(data.locations.map((l) => [l.id, l.name]));
  const emptyCount = data.items.filter((i) => i.quantity <= 0).length;

  const flat = Boolean(locationFilter) || expiryOnly || Boolean(query.trim()) || selectionMode;
  const allSelected = filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));
  const urgentIds = new Set(data.soon.map((item) => item.id));
  const groups = Array.from(new Set([...data.locations.map((loc) => loc.id), ...filtered.map((item) => item.location_id)]))
    .map((id) => ({
      id,
      name: locName.get(id) ?? "Alt loc",
      items: filtered.filter((item) => item.location_id === id),
    }))
    .filter((group) => group.items.length > 0);

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

  /** Ștergere cu „Anulează” în toast, ca la lista de cumpărături (ștergerea e logică). */
  async function removeItem(i: PantryItem) {
    setRevealed(null);
    const removed = await run(async (ctx) => {
      await removePantryItem(ctx, i.id);
      return true;
    });
    if (!removed) return;
    toast(`Am scos „${i.name}” din cămară.`, {
      action: {
        label: "Anulează",
        run: () => void run((ctx) => restorePantryItem(ctx, i.id), "Am pus produsul înapoi în cămară."),
      },
    });
  }

  async function executeBulkDelete() {
    const ids = confirmBulk.ids;
    setConfirmBulk({ open: false, ids: [], title: "", message: "" });
    if (ids.length === 0) return;
    const count = ids.length;
    const ok = await run(async (ctx) => {
      await removePantryItems(ctx, ids);
      return true;
    });
    if (!ok) return;
    setSelectedIds(new Set());
    if (selectionMode) setSelectionMode(false);
    toast(`Am scos ${count === 1 ? "un produs" : `${count} produse`} din cămară.`, {
      action: {
        label: "Anulează",
        run: () => void run((ctx) => restorePantryItems(ctx, ids), "Am pus produsele înapoi în cămară."),
      },
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

  function renderItems(items: PantryItem[]) {
    return (
      <ul className="divide-y divide-line overflow-hidden">
        {items.map((i) => {
          const state = expiryState(i, today);
          const edge = state === "expirat" ? "border-l-[3px] border-l-accent" : state === "expira_curand" ? "border-l-[3px] border-l-warn" : "";
          return (
          <li key={i.id}
            className={`touch-pan-y ${edge}`}
            onTouchStart={(e) => { const point = e.touches[0]; touchStart.current = { id: i.id, x: point.clientX, y: point.clientY }; }}
            onTouchEnd={(e) => { const start = touchStart.current; const point = e.changedTouches[0]; if (start?.id === i.id && start.x - point.clientX > 60 && Math.abs(start.y - point.clientY) < 40) setRevealed(i.id); touchStart.current = null; }}
          >
            <div className="flex items-center gap-1.5 py-1 pl-3 pr-1 sm:gap-2">
              <button type="button" onClick={() => startEdit(i)} className="flex min-h-12 min-w-0 flex-1 items-center gap-3 py-1 text-left transition-colors hover:text-brand">
                <span className={`hidden size-9 shrink-0 items-center justify-center rounded-xl min-[380px]:flex ${state === "expirat" ? "bg-accent-soft text-accent" : state === "expira_curand" ? "bg-warn-soft text-warn" : "bg-info-soft text-info"}`} aria-hidden>
                  <JarIcon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-medium text-[15px] leading-snug ${i.quantity <= 0 ? "text-ink-3 line-through" : "text-ink"}`}>{i.name}</span>
                  <span className="flex flex-wrap items-center gap-2 text-xs text-ink-2 tabular">
                    <span>{formatQuantity(i.quantity, i.unit)}</span>
                    {expiryBadge(i, today)}
                    {flat && <span>· {locName.get(i.location_id) ?? "Alt loc"}</span>}
                  </span>
                </span>
              </button>
              {selectionMode ? (
                <label className="flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(i.id)}
                    onChange={() => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(i.id)) next.delete(i.id);
                        else next.add(i.id);
                        return next;
                      });
                    }}
                    aria-label={`Selectează ${i.name}`}
                    className="h-5 w-5 rounded border-line cursor-pointer"
                  />
                </label>
              ) : (
                <>
                  <IconButton label={`Scade ${i.name}`} onClick={() => run((ctx) => adjustPantry(ctx, i.id, -(STEP[i.unit] ?? 1)))} disabled={i.quantity <= 0}>
                    <Minus size={18} />
                  </IconButton>
                  <AddButton aria-label={`Adaugă ${i.name}`} onClick={() => run((ctx) => adjustPantry(ctx, i.id, STEP[i.unit] ?? 1))} />
                  <IconButton label={`Acțiuni pentru ${i.name}`} aria-expanded={revealed === i.id} onClick={() => setRevealed(revealed === i.id ? null : i.id)}><MoreHorizontal size={18} /></IconButton>
                </>
              )}
            </div>
            {!selectionMode && revealed === i.id && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-surface-2/90 p-2.5">
              <Button variant="secondary" disabled={busy} onClick={async () => { const result = await run((ctx) => finishPantryToList(ctx, i.id)); if (result) { setRevealed(null); toast(`„${i.name}” s-a terminat. L-am pus pe lista de cumpărături.`); } }}>S-a terminat → Pe listă</Button>
              <Button variant="ghost" onClick={() => { setRevealed(null); startEdit(i); }}>Editează sau mută</Button>
              <Button variant="ghost" disabled={busy} onClick={() => void toShoppingList(i)}>Pune pe listă</Button>
              <Button variant="danger" aria-label={`Scoate ${i.name} din cămară`} disabled={busy} onClick={() => void removeItem(i)}>Scoate</Button>
            </div>}
          </li>
          );
        })}
      </ul>
    );
  }

  return (
    <>
      <PageHeader
        title="Cămară și frigider"
        captureRef={captureRef}
        subtitle={`${data.items.filter((i) => i.quantity > 0).length} produse acasă`}
      />
      {data.soon.length > 0 && (
        <button
          type="button"
          onClick={() => setExpiryOnly(!expiryOnly)}
          aria-pressed={expiryOnly}
          className="mb-4 flex w-full items-center gap-3 rounded-[20px] bg-brand-soft px-4 py-3 text-left shadow-card transition-colors hover:brightness-95 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent" aria-hidden>
            <Clock size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">
              {data.soon.length === 1 ? "1 produs se apropie de termen" : `${data.soon.length} produse se apropie de termen`}
            </span>
            <span className="block truncate text-xs text-ink-2">
              {data.soon.slice(0, 2).map((x) => x.name).join(" și ")}
            </span>
          </span>
          <span className="shrink-0 text-xs font-semibold text-brand">
            {expiryOnly ? "Arată tot" : "Vezi"}
          </span>
        </button>
      )}
      {selectionMode && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
          <span className="font-medium text-ink">
            {selectedIds.size === 0 ? "Alege produsele de șters" : `${selectedIds.size} ${selectedIds.size === 1 ? "produs selectat" : "produse selectate"}`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={filtered.length === 0}
              onClick={() => {
                setSelectedIds((previous) => {
                  const next = new Set(previous);
                  for (const item of filtered) {
                    if (allSelected) next.delete(item.id);
                    else next.add(item.id);
                  }
                  return next;
                });
              }}
            >
              {allSelected ? "Deselectează tot" : "Selectează tot"}
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const ids = Array.from(selectedIds);
                  setConfirmBulk({
                    open: true,
                    ids,
                    title: `Ștergi ${ids.length === 1 ? "produsul selectat" : `cele ${ids.length} produse selectate`}?`,
                    message: "Produsele vor fi scoase din cămară. Vei putea anula acțiunea din notificarea de jos.",
                  });
                }}
              >
                Șterge ({selectedIds.size})
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="mb-4 flex items-center gap-2 rounded-full bg-surface-container-high px-4 transition-all duration-150 focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/25">
        <Search size={18} className="text-ink-3" aria-hidden />
        <input value={query} onChange={(e) => setQuery(e.target.value)} type="search" placeholder="Caută în toate locurile" aria-label="Caută în cămară" className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none" />
      </div>

      {data.items.length > 0 && (
        <div role="group" aria-label="Filtre pentru stoc" className="mb-3 flex flex-wrap items-center gap-2">
          {(data.soon.length > 0 || expiryOnly) && (
            <Chip active={expiryOnly} onClick={() => setExpiryOnly(!expiryOnly)}>
              <AlertTriangle size={16} className="text-warn" />
              Expiră curând ({data.soon.length})
            </Chip>
          )}
          {data.locations.filter((loc) => data.items.some((i) => (showEmpty || i.quantity > 0) && i.location_id === loc.id)).map((loc) => (
            <Chip key={loc.id} active={locationFilter === loc.id} onClick={() => setLocationFilter(locationFilter === loc.id ? null : loc.id)}>
              {loc.name}
            </Chip>
          ))}
          {emptyCount > 0 && !expiryOnly && (
            <Chip active={showEmpty} onClick={() => setShowEmpty(!showEmpty)}>
              {showEmpty ? "Ascunde produsele terminate" : `Arată produsele terminate (${emptyCount})`}
            </Chip>
          )}
          <Button
            className="ml-auto"
            variant={selectionMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setSelectionMode(!selectionMode);
              setSelectedIds(new Set());
              setRevealed(null);
            }}
          >
            {selectionMode ? "Gata" : "Selectează"}
          </Button>
        </div>
      )}
      {expiryOnly && data.useSoon.length > 0 && (
        <details className="app-card mb-3 px-4">
          <summary className="cursor-pointer py-3 text-sm font-medium text-ink">Rețete pentru produsele care expiră curând</summary>
          <ul className="flex flex-wrap gap-x-4 gap-y-2 pb-3 text-sm text-brand">
            {data.useSoon.map(({ recipe }) => (
              <li key={recipe.id}><Link className="underline" href={`/retete/reteta/?id=${recipe.id}`}>{recipe.name}</Link></li>
            ))}
          </ul>
        </details>
      )}

      <p role="status" className="sr-only">{filtered.length} produse afișate</p>
      {data.items.length === 0 ? (
        <EmptyState icon={<JarIcon size={32} />} title="Cămara e goală">
          Folosește butonul + pentru a adăuga ce ai acasă.
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState title={query.trim() ? "Niciun produs găsit" : expiryOnly ? "Niciun produs cu termen apropiat" : "Nu mai ai produse în stoc"} />
      ) : flat ? (
        <div className="overflow-hidden app-card">{renderItems(filtered)}</div>
      ) : (
        <div aria-label="Stoc pe locuri" className="space-y-2">
          {groups.map(({ id, name, items }) => {
            const urgent = items.filter((item) => urgentIds.has(item.id)).length;
            return (
              <details key={id} name="pantry-locations" className="group/location overflow-hidden app-card">
                <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1 font-semibold text-ink">{name}</span>
                  <span className="flex flex-col items-end gap-0.5 text-right text-xs text-ink-2">
                    <span>{items.length} {items.length === 1 ? "produs" : "produse"}</span>
                    {urgent > 0 && <Badge tone="warn">{urgent} cu termen apropiat</Badge>}
                  </span>
                  <ChevronDown size={18} className="shrink-0 text-ink-2 group-open/location:rotate-180" />
                </summary>
                <div className="border-t border-line">{renderItems(items)}</div>
              </details>
            );
          })}
        </div>
      )}

      {emptyCount > 0 && showEmpty && !expiryOnly && (
        <div className="mt-3">
          <Button
            variant="danger"
            onClick={() => {
              const emptyIds = data.items.filter((i) => i.quantity <= 0).map((i) => i.id);
              setConfirmBulk({
                open: true,
                ids: emptyIds,
                title: `Ștergi ${emptyIds.length === 1 ? "produsul terminat" : `cele ${emptyIds.length} produse terminate`}?`,
                message: "Produsele vor fi scoase din cămară. Vei putea anula acțiunea din notificarea de jos.",
              });
            }}
          >
            Curăță produsele terminate ({emptyCount})
          </Button>
        </div>
      )}

      <Sheet
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? draft.name : "Adaugă în cămară"}
        footer={
          <div className="flex flex-wrap gap-2">
            {draft?.id && (
              <Button
                variant="danger"
                icon={<Trash2 size={18} />}
                aria-label="Scoate din cămară"
                onClick={async () => {
                  const id = draft.id!;
                  setDraft(null);
                  await run((ctx) => removePantryItem(ctx, id), "Am scos produsul din cămară.");
                }}
              />
            )}
            {draft?.id && (
              <Button
                variant="secondary"
                icon={<BasketIcon size={18} />}
                onClick={() => {
                  const item = data.items.find((x) => x.id === draft.id);
                  if (item) void toShoppingList(item);
                }}
              >
                Pune pe listă
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
            {!draft.product_id && <LabeledInput label="Numele produsului" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} />}
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput label="Cantitate" inputMode="decimal" value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} />
              <LabeledSelect label="Unitate" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as UnitCode })}>
                {SHOPPING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(u, 2)}
                  </option>
                ))}
              </LabeledSelect>
            </div>
            <LabeledSelect label="Unde îl ții" value={draft.location_id} onChange={(e) => setDraft({ ...draft, location_id: e.target.value })}>
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
                hint="După această dată, îl scot automat din cămară. Șterge data dacă vrei să-l păstrezi."
              />
            )}
            <LabeledInput label="Observații" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} maxLength={300} placeholder="ex. deschis, de folosit în 3 zile" />
          </div>
        )}
      </Sheet>
      <ConfirmSheet
        open={confirmBulk.open}
        onClose={() => setConfirmBulk({ open: false, ids: [], title: "", message: "" })}
        onConfirm={() => void executeBulkDelete()}
        title={confirmBulk.title}
        message={confirmBulk.message}
        confirmLabel="Șterge"
      />
    </>
  );
}

export default function Page() {
  const [captureTarget, setCaptureTarget] = useState<HTMLDivElement | null>(null);

  return (
    <AppShell captureTarget={captureTarget}>
      <PantryScreen captureRef={setCaptureTarget} />
    </AppShell>
  );
}
