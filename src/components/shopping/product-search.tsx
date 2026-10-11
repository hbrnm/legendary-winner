"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Search } from "lucide-react";
import { useData } from "@/components/app/hooks";
import { productSearchIndex } from "@/lib/services/catalog";
import { frequentProducts } from "@/lib/domain/pantry";
import { search } from "@/lib/domain/search";
import { parseQuickAdd, type QuickAdd } from "@/lib/domain/quick-add";
import { formatQuantity } from "@/lib/domain/units";
import { owned } from "@/lib/services/queries";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { Product } from "@/lib/domain/types";

export interface PickedProduct {
  product: Product | null;
  parsed: QuickAdd;
}

/**
 * Căutare cu completare automată în catalog. Înțelege și cantitatea scrisă
 * („2 kg roșii”). Enter alege primul rezultat sau adaugă textul ca produs nou.
 */
export function ProductSearch({ onPick, placeholder = "Adaugă: ex. 2 kg roșii", autoFocus }: { onPick: (p: PickedProduct) => void; placeholder?: string; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const data = useData(async (ctx) => {
    const freq = frequentProducts(await owned(ctx.db, "shopping_transaction_items", ctx.householdId), toISODate(now()), 120, 1);
    const boosts = new Map(freq.map((f) => [f.product_id, Math.min(15, f.count * 3)]));
    const index = await productSearchIndex(ctx, boosts);
    const products = new Map((await ctx.db.products.toArray()).map((p) => [p.id, p]));
    return { index, products };
  });

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const hits = useMemo(() => (data && parsed.text.length >= 1 ? search(data.index, parsed.text, 6) : []), [data, parsed.text]);

  function pick(product: Product | null) {
    if (!parsed.text) return;
    onPick({ product, parsed });
    setText("");
    setActive(0);
    inputRef.current?.focus();
  }

  const options = [...hits.map((h) => data!.products.get(h.doc.id) ?? null), null];

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-3 shadow-card focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
        <Search size={18} className="shrink-0 text-ink-3" aria-hidden />
        <input
          ref={inputRef}
          value={text}
          autoFocus={autoFocus}
          onChange={(e) => {
            setText(e.target.value);
            setActive(0);
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
              pick(options[active] ?? null);
            } else if (e.key === "Escape") setText("");
          }}
          placeholder={placeholder}
          aria-label="Caută sau adaugă un produs"
          role="combobox"
          aria-expanded={text.length > 0}
          aria-controls="rezultate-produse"
          aria-autocomplete="list"
          enterKeyHint="done"
          autoComplete="off"
          className="h-12 min-w-0 flex-1 bg-transparent text-base text-ink placeholder:text-ink-3 focus:outline-none"
        />
      </div>
      {text.trim() && (
        <ul id="rezultate-produse" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
          {options.map((p, i) => (
            <li key={p?.id ?? "_nou"} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
                className={`flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left ${i === active ? "bg-surface-2" : ""}`}
              >
                {p ? (
                  <>
                    <span className="text-[15px] text-ink">{p.name}</span>
                    <span className="shrink-0 text-xs text-ink-2">{parsed.quantity ? formatQuantity(parsed.quantity, parsed.unit ?? p.default_unit) : ""}</span>
                  </>
                ) : (
                  <span className="flex items-center gap-2 text-[15px] text-brand">
                    <Plus size={16} />
                    Adaugă „{parsed.text}” ca produs nou
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
