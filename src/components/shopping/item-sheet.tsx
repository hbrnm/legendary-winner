"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, LabeledSelect, Segmented, TextArea } from "@/components/ui/fields";
import type { ProductCategory, ProductVariant, PurchaseSource, Retailer, ShoppingList, ShoppingListItem, UnitCode } from "@/lib/domain/types";
import { VariantPicker, type NewVariant } from "./variant-picker";
import { SHOPPING_UNITS, unitLabel } from "@/lib/domain/units";
import { formatRon, parseMoney } from "@/lib/domain/money";
import { SOURCE_LABELS } from "@/lib/domain/budget";
import type { LineEstimate } from "@/lib/domain/shopping";
import { formatShortDate } from "@/lib/domain/dates";
import { defaultShelfBasis, SHELF_BASES, totalFromShelfPrice, type ShelfBasis } from "@/lib/domain/pricing";

export interface ItemSheetProps {
  item: ShoppingListItem | null;
  estimate: LineEstimate | null;
  categories: ProductCategory[];
  retailers: Retailer[];
  lists: ShoppingList[];
  focusPrice?: boolean;
  /** Variantele produsului liniei; lipsă = fără secțiunea „Marca și ambalajul”. */
  variants?: { list: ProductVariant[]; brands: ReadonlyMap<string, string>; onCreate: (input: NewVariant) => Promise<string | null> };
  onClose: () => void;
  onSave: (patch: Partial<ShoppingListItem>) => void;
  onMove: (listId: string) => void;
  onDelete: () => void;
}

/** „Din prețuri: 12,50 lei · Lidl, 3 oct. · din alt magazin”: de unde vine estimarea. */
function estimateHint(e: LineEstimate, retailers: Retailer[]): string {
  const p = e.price;
  if (!p) return `Din prețuri: ${formatRon(e.amount)}`;
  const where = retailers.find((r) => r.id === p.retailer_id)?.name ?? SOURCE_LABELS[p.source];
  const flags = [p.match === "alt_magazin" && "din alt magazin", p.promo && "preț de promoție", p.stale && "preț vechi"].filter(Boolean);
  return [`Din prețuri: ${formatRon(e.amount)}`, `${where}, ${formatShortDate(p.observed_on)}`, ...flags].join(" · ");
}

const STEP: Partial<Record<UnitCode, number>> = { kg: 0.5, g: 100, l: 0.5, ml: 250 };

const decimal = (n: number) => String(n).replace(".", ",");

type Shelf = { price: string; basis: ShelfBasis; quantity: string; unit: UnitCode | "" };

/** Totalul din prețul de la raft, sau ce lipsește ca să-l calculăm. */
function shelfTotal(s: Shelf): { total: number; hint: string } | { error: string } | null {
  if (!s.price.trim()) return null;
  const shelf = parseMoney(s.price);
  if (shelf == null) return { error: "Prețul la raft nu e valid. Scrie de exemplu 7,99." };
  const q = s.quantity ? Number(s.quantity.replace(",", ".")) : null;
  if (q == null || !(q > 0)) return { error: "Scrie cantitatea ca să calculăm totalul." };
  const unit = (s.unit || "buc") as UnitCode;
  const b = SHELF_BASES.find((x) => x.basis === s.basis)!;
  const total = totalFromShelfPrice(shelf, s.basis, q, unit);
  if (total == null) {
    const what = unit === "buc" ? "bucățile" : `cantitatea în ${unitLabel(unit, 2)}`;
    return { error: `Prețul ${b.label} nu se potrivește cu ${what}. Alege altă bază sau scrie totalul.` };
  }
  return { total, hint: `Calculat: ${decimal(q)} ${unitLabel(unit, q)} × ${shelf.toFixed(2).replace(".", ",")} lei/${b.short}. Îl poți corecta.` };
}

/** Editarea unui produs din listă: cantitate, preț real, magazin, sursă, observații. */
export function ItemSheet(props: ItemSheetProps) {
  if (!props.item) return null;
  return <ItemSheetForm key={props.item.id} {...props} item={props.item} />;
}

function ItemSheetForm({ item, estimate, categories, retailers, lists, focusPrice, variants, onClose, onSave, onMove, onDelete }: ItemSheetProps & { item: ShoppingListItem }) {
  const [variantId, setVariantId] = useState<string | null>(item.variant_id ?? null);
  const [quantity, setQuantity] = useState(item.quantity == null ? "" : String(item.quantity).replace(".", ","));
  const [unit, setUnit] = useState<UnitCode | "">(item.unit ?? "");
  const [price, setPrice] = useState(item.actual_price == null ? "" : item.actual_price.toFixed(2).replace(".", ","));
  const [estimated, setEstimated] = useState(item.estimated_price == null ? "" : item.estimated_price.toFixed(2).replace(".", ","));
  const [retailerId, setRetailerId] = useState(item.retailer_id ?? "");
  const [source, setSource] = useState<PurchaseSource>(item.source);
  const [categoryId, setCategoryId] = useState(item.category_id);
  const [priority, setPriority] = useState<"normala" | "ridicata">(item.priority);
  const [note, setNote] = useState(item.note ?? "");
  const [name, setName] = useState(item.name);
  const [error, setError] = useState<string | null>(null);
  const [atShelf, setAtShelf] = useState(false);
  const [shelf, setShelf] = useState<Pick<Shelf, "price" | "basis">>({ price: "", basis: defaultShelfBasis(item.unit) });
  const computed = atShelf ? shelfTotal({ ...shelf, quantity, unit }) : null;

  /** La raft, orice schimbare a prețului, a bazei sau a cantității recalculează totalul (decizia proprietarului, 12 oct. 2026). */
  function change(next: Partial<Shelf>) {
    if (next.quantity !== undefined) setQuantity(next.quantity);
    if (next.unit !== undefined) setUnit(next.unit);
    const nextShelf = { price: next.price ?? shelf.price, basis: next.basis ?? shelf.basis };
    if (next.price !== undefined || next.basis !== undefined) setShelf(nextShelf);
    if (!atShelf && next.price === undefined && next.basis === undefined) return;
    applyShelf(shelfTotal({ ...nextShelf, quantity: next.quantity ?? quantity, unit: next.unit ?? unit }));
  }

  /** Un total care nu se mai poate calcula se golește, ca să nu rămână unul vechi. */
  function applyShelf(r: ReturnType<typeof shelfTotal>) {
    if (r) setPrice("total" in r ? r.total.toFixed(2).replace(".", ",") : "");
  }

  const step = STEP[(unit || "buc") as UnitCode] ?? 1;
  const q = quantity ? Number(quantity.replace(",", ".")) : null;

  function bump(delta: number) {
    const next = Math.max(step, Math.round(((q ?? 0) + delta) * 1000) / 1000);
    change({ quantity: decimal(next), unit: unit || "buc" });
  }

  function save() {
    const actual = price.trim() ? parseMoney(price) : null;
    const est = estimated.trim() ? parseMoney(estimated) : null;
    if (price.trim() && actual == null) return setError("Prețul nu e valid. Scrie de exemplu 12,50.");
    if (estimated.trim() && est == null) return setError("Estimarea nu e validă. Scrie de exemplu 12,50.");
    if (q != null && !(q > 0)) return setError("Cantitatea trebuie să fie mai mare decât zero.");
    if (!name.trim()) return setError("Scrie numele produsului.");
    const retailer = retailers.find((r) => r.id === retailerId);
    onSave({
      name: name.trim(),
      quantity: q,
      unit: q == null ? null : ((unit || "buc") as UnitCode),
      actual_price: actual,
      estimated_price: est,
      retailer_id: retailerId || null,
      source: retailer?.kind === "piata" ? "piata" : retailer?.kind === "producator" ? "producator" : source,
      category_id: categoryId,
      priority,
      note: note.trim() || null,
      ...(variants && item.product_id ? { variant_id: variantId } : {}),
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={item.name}
      footer={
        <div className="flex gap-2">
          <Button variant="danger" onClick={onDelete} icon={<Trash2 size={18} />} aria-label="Șterge din listă">
            <span className="sr-only sm:not-sr-only">Șterge</span>
          </Button>
          <Button block onClick={save}>
            Salvează
          </Button>
        </div>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Cantitate">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Mai puțin" onClick={() => bump(-step)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
              <Minus size={18} />
            </button>
            <Input inputMode="decimal" value={quantity} onChange={(e) => change({ quantity: e.target.value })} placeholder="—" className="min-w-0 flex-1 text-center tabular" aria-label="Cantitate" />
            <button type="button" aria-label="Mai mult" onClick={() => bump(step)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
              <Plus size={18} />
            </button>
            <select
              aria-label="Unitate"
              value={unit}
              onChange={(e) => change({ unit: e.target.value as UnitCode })}
              className="h-11 w-28 shrink-0 rounded-xl border border-line bg-surface px-3 text-[15px]"
            >
              <option value="">fără unitate</option>
              {SHOPPING_UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u, 2)}
                </option>
              ))}
            </select>
          </div>
        </Field>

        {variants && item.product_id && <VariantPicker variants={variants.list} brands={variants.brands} value={variantId} onChange={setVariantId} onCreate={variants.onCreate} />}

        <Segmented<"total" | "raft">
          label="Felul prețului"
          value={atShelf ? "raft" : "total"}
          onChange={(v) => {
            setAtShelf(v === "raft");
            if (v === "raft") applyShelf(shelfTotal({ ...shelf, quantity, unit }));
          }}
          options={[
            { value: "total", label: "Total plătit" },
            { value: "raft", label: "Preț la raft" },
          ]}
        />

        {atShelf && (
          <Field label="Preț la raft (lei)">
            <div className="flex items-center gap-2">
              <Input inputMode="decimal" value={shelf.price} onChange={(e) => change({ price: e.target.value })} placeholder="7,99" autoFocus className="min-w-0 flex-1 tabular" aria-label="Preț la raft" />
              <select
                aria-label="Baza prețului la raft"
                value={shelf.basis}
                onChange={(e) => change({ basis: e.target.value as ShelfBasis })}
                className="h-11 w-32 shrink-0 rounded-xl border border-line bg-surface px-3 text-[15px]"
              >
                {SHELF_BASES.map((b) => (
                  <option key={b.basis} value={b.basis}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Preț plătit (lei)"
            hint={computed && "hint" in computed ? computed.hint : "Pentru toată cantitatea"}
            error={computed && "error" in computed ? computed.error : null}
          >
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" autoFocus={focusPrice} className="tabular" aria-label="Preț plătit" />
          </Field>
          <Field label="Preț estimat (lei)" hint={estimate?.kind === "calculat" ? estimateHint(estimate, retailers) : "Opțional"}>
            <Input inputMode="decimal" value={estimated} onChange={(e) => setEstimated(e.target.value)} placeholder="—" className="tabular" aria-label="Preț estimat" />
          </Field>
        </div>

        <Field label="De unde">
          <Segmented<PurchaseSource>
            label="Sursa"
            value={source}
            onChange={setSource}
            options={(["supermarket", "piata", "producator", "alta"] as PurchaseSource[]).map((s) => ({ value: s, label: s === "producator" ? "Producător" : SOURCE_LABELS[s] }))}
          />
        </Field>

        <LabeledSelect label="Magazin sau piață" value={retailerId} onChange={(e) => setRetailerId(e.target.value)}>
          <option value="">Oriunde</option>
          {retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </LabeledSelect>

        <div className="grid grid-cols-2 gap-3">
          <LabeledSelect label="Categorie" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </LabeledSelect>
          <LabeledSelect label="Prioritate" value={priority} onChange={(e) => setPriority(e.target.value as "normala" | "ridicata")}>
            <option value="normala">Normală</option>
            <option value="ridicata">Important</option>
          </LabeledSelect>
        </div>

        <Field label="Denumire">
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </Field>

        <Field label="Observații">
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="ex. cel de 3,5% grăsime" className="min-h-16" />
        </Field>

        {lists.length > 0 && (
          <LabeledSelect label="Mută în altă listă" value="" onChange={(e) => e.target.value && onMove(e.target.value)}>
            <option value="">Alege lista…</option>
            {lists.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </LabeledSelect>
        )}

        {error && (
          <p role="alert" className="text-sm text-accent">
            {error}
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  );
}
