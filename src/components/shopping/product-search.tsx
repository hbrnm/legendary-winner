"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { keyboardInset } from "@/components/ui/sheet";
import { useData } from "@/components/app/hooks";
import { productSearchIndex } from "@/lib/services/catalog";
import { frequentProducts } from "@/lib/domain/pantry";
import { search } from "@/lib/domain/search";
import { parseQuickAdd, type QuickAdd } from "@/lib/domain/quick-add";
import { formatQuantity } from "@/lib/domain/units";
import { owned } from "@/lib/services/queries";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { Product, UnitCode } from "@/lib/domain/types";

export interface PickedProduct {
  product: Product | null;
  parsed: QuickAdd;
}

/**
 * Căutare cu completare automată în catalog. Înțelege și cantitatea scrisă
 * („2 kg roșii”). Enter alege primul rezultat sau adaugă textul ca produs nou.
 * `allowNew={false}`: unde nu se poate crea produs, fără „ca produs nou”, cu un mesaj.
 * `inline`: rezultatele în pagină, sub câmp (în ferestre, unde lista suprapusă ar fi tăiată).
 */
export function ProductSearch({
  onPick,
  placeholder = "Adaugă: ex. 2 kg roșii",
  autoFocus,
  allowNew = true,
  inline = false,
  intent = allowNew ? "add" : "search",
}: {
  onPick: (p: PickedProduct) => void;
  placeholder?: string;
  autoFocus?: boolean;
  allowNew?: boolean;
  inline?: boolean;
  intent?: "add" | "search";
}) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!focused || !viewport) return;
    const update = () => setKeyboardOffset(keyboardInset(window.innerHeight, viewport));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => { viewport.removeEventListener("resize", update); viewport.removeEventListener("scroll", update); };
  }, [focused]);
  const [active, setActive] = useState(0);
  // Enter apăsat înainte să se încarce catalogul: alegem după încărcare, ca textul să nu devină o dublură a produsului din catalog.
  const enterPending = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const data = useData(async (ctx) => {
    const freq = frequentProducts(await owned(ctx.db, "shopping_transaction_items", ctx.householdId), toISODate(now()), 120, 1);
    const boosts = new Map(freq.map((f) => [f.product_id, Math.min(15, f.count * 3)]));
    const index = await productSearchIndex(ctx, boosts);
    const products = new Map((await ctx.db.products.toArray()).map((p) => [p.id, p]));
    return { index, products, frequent: freq.slice(0, 6).flatMap((f) => { const product = products.get(f.product_id); return product ? [product] : []; }) };
  });

  const parsed = useMemo(() => {
    // A selected unit is a draft prefix until a product is chosen.
    const prefix = /^(\d+(?:[.,]\d+)?)\s+(buc|kg|g|l|ml)\s*$/.exec(text.trim());
    return prefix ? { text: "", quantity: Number(prefix[1].replace(",", ".")), unit: prefix[2] as UnitCode } : parseQuickAdd(text);
  }, [text]);
  const hits = useMemo(() => (data && parsed.text.length >= 1 ? search(data.index, parsed.text, 6) : []), [data, parsed.text]);

  function pick(product: Product | null) {
    if (!parsed.text || (!product && !allowNew)) return;
    onPick({ product, parsed });
    setText("");
    setActive(0);
    inputRef.current?.focus();
  }

  const options: (Product | null)[] = useMemo(() => {
    if (!data || !parsed.text) return [];
    const found = hits.map((h) => data.products.get(h.doc.id)).filter((p): p is Product => Boolean(p));
    return allowNew ? [...found, null] : found;
  }, [hits, data, allowNew, parsed.text]);

  useEffect(() => {
    if (!enterPending.current || !data) return;
    enterPending.current = false;
    pick(options[0] ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rulează doar când s-a încărcat catalogul
  }, [data]);

  return (
    <div className="relative" onFocus={() => setFocused(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false); }}>
      <div className="flex items-center gap-3 rounded-full border border-transparent bg-surface-container-high px-5 transition-colors duration-150 ease-out focus-within:border-brand focus-within:bg-surface focus-within:ring-2 focus-within:ring-brand/25">
        {intent === "add" ? <Plus size={20} className="shrink-0 text-brand" aria-hidden /> : <Search size={18} className="shrink-0 text-ink-3" aria-hidden />}
        <input
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
            enterPending.current = false;
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (!data) enterPending.current = true;
              else pick(options[active] ?? null);
            } else if (e.key === "Escape") setText("");
          }}
          placeholder={placeholder}
          aria-label="Caută sau adaugă un produs"
          role="combobox"
          aria-expanded={Boolean(parsed.text.trim() && options.length > 0)}
          aria-controls={parsed.text.trim() && options.length > 0 ? "rezultate-produse" : undefined}
          aria-activedescendant={parsed.text.trim() && options.length > 0 && options[active] !== undefined ? `produs-opt-${active}` : undefined}
          aria-autocomplete="list"
          enterKeyHint="done"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </div>
      {focused && intent === "add" && (
        <div className="inset-x-4 z-40 mx-auto flex max-w-xl flex-col gap-2 rounded-2xl border border-line bg-surface p-3 shadow-elevated" style={{ position: "fixed", bottom: `calc(${Math.max(104, keyboardOffset + 8)}px + env(safe-area-inset-bottom))` }}>
          <div role="group" aria-label="Cantități rapide" className="flex gap-2 overflow-x-auto pb-1">
            {([{ quantity: 1, unit: "buc" }, { quantity: 500, unit: "g" }, { quantity: 1, unit: "kg" }, { quantity: 1, unit: "l" }] as const).map(({ quantity, unit }) => (
              <button key={unit} type="button" aria-pressed={parsed.unit === unit && parsed.quantity === quantity} onMouseDown={(e) => e.preventDefault()} onClick={() => {
                const quantityOnly = /^\d+(?:[.,]\d+)?$/.test(text.trim());
                setText(`${quantity} ${unit} ${quantityOnly ? "" : parsed.text}`);
                enterPending.current = false;
                setActive(0);
                inputRef.current?.focus();
              }} className="min-h-11 min-w-11 shrink-0 rounded-xl border border-line bg-surface px-3 text-sm text-ink-2">{quantity} {unit}</button>
            ))}
          </div>
          {!parsed.text && (data?.frequent.length ?? 0) > 0 && <div role="group" aria-label="Cumperi des" className="flex gap-2 overflow-x-auto pb-1">
            {data!.frequent.map((product) => <button key={product.id} type="button" aria-label={`Adaugă ${product.name}`} onMouseDown={(e) => e.preventDefault()} onClick={() => { onPick({ product, parsed: { ...parsed, text: product.name } }); setText(""); setActive(0); inputRef.current?.focus(); }} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-xl bg-brand-soft px-3 text-sm text-brand"><Plus size={15} aria-hidden />{product.name}</button>)}
          </div>}
        </div>
      )}
      {parsed.text.trim() && options.length === 0 && (
        <p role="status" className={`${inline ? "" : "absolute inset-x-0 top-full z-20 shadow-card"} mt-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-ink-2`}>
          {data ? `Nu am găsit „${parsed.text}” în catalog.` : "Caut în catalog…"}
        </p>
      )}
      {parsed.text.trim() && options.length > 0 && (
        <ul id="rezultate-produse" role="listbox" className={`${inline ? "" : "absolute inset-x-0 top-full z-20 shadow-card"} mt-1 overflow-hidden rounded-[28px] bg-surface`}>
          {options.map((p, i) => (
            <li
              key={p?.id ?? "_nou"}
              id={`produs-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(p)}
              className={`flex min-h-12 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left transition-colors duration-150 ease-out select-none ${i === active ? "bg-surface-2" : "hover:bg-surface-2/60"}`}
            >
              {p ? (
                <>
                  <span className="text-[15px] text-ink">{p.name}</span>
                  <span className="shrink-0 text-xs text-ink-2">{parsed.quantity ? formatQuantity(parsed.quantity, parsed.unit ?? p.default_unit) : ""}</span>
                </>
              ) : (
                <span className="flex items-center gap-2 text-[15px] font-medium text-brand">
                  <Plus size={16} />
                  Adaugă „{parsed.text}” ca produs nou
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
