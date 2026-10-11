"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, LabeledSelect, Segmented, TextArea } from "@/components/ui/fields";
import type { ProductCategory, PurchaseSource, Retailer, ShoppingList, ShoppingListItem, UnitCode } from "@/lib/domain/types";
import { SHOPPING_UNITS, unitLabel } from "@/lib/domain/units";
import { formatRon, parseMoney } from "@/lib/domain/money";
import { SOURCE_LABELS } from "@/lib/domain/budget";
import type { LineEstimate } from "@/lib/domain/shopping";
import { formatShortDate } from "@/lib/domain/dates";

export interface ItemSheetProps {
  item: ShoppingListItem | null;
  estimate: LineEstimate | null;
  categories: ProductCategory[];
  retailers: Retailer[];
  lists: ShoppingList[];
  focusPrice?: boolean;
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

/** Editarea unui produs din listă: cantitate, preț real, magazin, sursă, observații. */
export function ItemSheet(props: ItemSheetProps) {
  if (!props.item) return null;
  return <ItemSheetForm key={props.item.id} {...props} item={props.item} />;
}

function ItemSheetForm({ item, estimate, categories, retailers, lists, focusPrice, onClose, onSave, onMove, onDelete }: ItemSheetProps & { item: ShoppingListItem }) {
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

  const step = STEP[(unit || "buc") as UnitCode] ?? 1;
  const q = quantity ? Number(quantity.replace(",", ".")) : null;

  function bump(delta: number) {
    const next = Math.max(step, Math.round(((q ?? 0) + delta) * 1000) / 1000);
    setQuantity(String(next).replace(".", ","));
    if (!unit) setUnit("buc");
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
            <Input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="—" className="min-w-0 flex-1 text-center tabular" aria-label="Cantitate" />
            <button type="button" aria-label="Mai mult" onClick={() => bump(step)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-surface">
              <Plus size={18} />
            </button>
            <select
              aria-label="Unitate"
              value={unit}
              onChange={(e) => setUnit(e.target.value as UnitCode)}
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Preț plătit (lei)" hint="Pentru toată cantitatea">
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
