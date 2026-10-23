"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Tags, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { useApp } from "@/components/app/app-provider";
import { VariantPicker } from "@/components/shopping/variant-picker";
import { ProductSearch } from "@/components/shopping/product-search";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, SectionTitle, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect, Segmented } from "@/components/ui/fields";
import { owned, priceIndex, visible } from "@/lib/services/queries";
import { deletePrice, recordPrice } from "@/lib/services/money";
import { createRetailer, createVariant } from "@/lib/services/catalog";
import { compareVariants, variantLabel, variantsOf } from "@/lib/domain/variants";
import { UserError } from "@/lib/services/context";
import { formatRon, parseMoney } from "@/lib/domain/money";
import { canConvert, convert, SHOPPING_UNITS, unitLabel } from "@/lib/domain/units";
import { formatShortDate, toISODate } from "@/lib/domain/dates";
import { SOURCE_LABELS } from "@/lib/domain/budget";
import { now } from "@/lib/clock";
import type { PriceType, Product, ProductPrice, PurchaseSource, UnitCode } from "@/lib/domain/types";

const TYPE_LABELS: Record<PriceType, string> = { platit: "plătit", observat: "văzut", promotie: "promoție", estimat: "estimat" };

/** Etichetele ca ștampile: majuscule, fără pastilă (decizia proprietarului, 18 oct. 2026). */
const STAMP = "whitespace-nowrap text-[11px] font-medium uppercase tracking-wider";

/** Prețul pe unitatea de referință a produsului (ex. lei/kg), dacă se poate converti. */
function perUnit(p: ProductPrice, unit: UnitCode): number | null {
  if (!canConvert(p.unit, unit)) return null;
  const q = convert(p.quantity, p.unit, unit)!;
  return q > 0 ? p.amount / q : null;
}

function PricesScreen() {
  const { run, busy } = useAction();
  const { variantsEnabled } = useApp();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState<UnitCode>("kg");
  const [source, setSource] = useState<PurchaseSource>("supermarket");
  const [retailerId, setRetailerId] = useState("");
  const [date, setDate] = useState(toISODate(now()));
  const [type, setType] = useState<PriceType>("observat");
  const [newPlace, setNewPlace] = useState("");
  const [error, setError] = useState<string | null>(null);

  const data = useData(async (ctx) => {
    const [prices, retailers, products, variants, brands, index] = await Promise.all([
      owned(ctx.db, "product_prices", ctx.householdId),
      visible(ctx.db, "retailers", ctx.householdId),
      visible(ctx.db, "products", ctx.householdId),
      visible(ctx.db, "product_variants", ctx.householdId),
      visible(ctx.db, "brands", ctx.householdId),
      priceIndex(ctx.db, ctx.householdId),
    ]);
    const bought = await ctx.db.shopping_transaction_items.bulkGet(prices.flatMap((p) => (p.transaction_item_id ? [p.transaction_item_id] : [])));
    return {
      prices,
      // Numele de pe bon al cumpărăturii din care vine prețul (.tasks/016).
      receiptNames: new Map(bought.flatMap((i) => (i?.receipt_name ? [[i.id, i.receipt_name] as const] : []))),
      retailers: retailers.sort((a, b) => a.name.localeCompare(b.name, "ro")),
      products: new Map(products.map((p) => [p.id, p])),
      variants,
      brands: new Map(brands.map((b) => [b.id, b.name])),
      index,
    };
  });

  const view = useMemo(() => {
    if (!data) return null;
    const retailerName = new Map(data.retailers.map((r) => [r.id, r.name]));
    const place = (p: ProductPrice) => (p.retailer_id ? (retailerName.get(p.retailer_id) ?? "—") : SOURCE_LABELS[p.source]);
    const receiptName = (p: ProductPrice) => (p.transaction_item_id ? (data.receiptNames.get(p.transaction_item_id) ?? null) : null);
    const variantById = new Map(data.variants.map((v) => [v.id, v]));
    const variantName = (id: string | null | undefined) => {
      const v = id ? variantById.get(id) : undefined;
      return v ? variantLabel(v, v.brand_id ? data.brands.get(v.brand_id) : null) : null;
    };
    if (!product) {
      const recent = [...data.prices].sort((a, b) => b.observed_on.localeCompare(a.observed_on) || b.updated_at.localeCompare(a.updated_at)).slice(0, 25);
      return { place, receiptName, variantName, recent, history: [], compare: [], brands: [], productVariants: [] };
    }
    const history = data.prices.filter((p) => p.product_id === product.id).sort((a, b) => b.observed_on.localeCompare(a.observed_on));
    const latestByPlace = new Map<string, ProductPrice>();
    for (const p of history) {
      const k = p.retailer_id ?? `sursa:${p.source}`;
      if (!latestByPlace.has(k)) latestByPlace.set(k, p);
    }
    const compare = [...latestByPlace.values()]
      .map((p) => ({ p, unitPrice: perUnit(p, product.default_unit) }))
      .sort((a, b) => (a.unitPrice ?? Infinity) - (b.unitPrice ?? Infinity));
    // Prețul pe kg pe mărci, doar când produsul are prețuri pe variante.
    const byBrand = compareVariants(data.index, product.id, toISODate(now()));
    const brandsRows = variantsEnabled && byBrand.some((r) => r.variant_id) ? byBrand : [];
    return { place, receiptName, variantName, recent: [], history, compare, brands: brandsRows, productVariants: variantsOf(data.variants, product.id) };
  }, [data, product, variantsEnabled]);

  if (!data || !view) return <Spinner />;

  function openAdd() {
    setAdding(true);
    setError(null);
    setAmount("");
    setQuantity("1");
    setUnit(product?.default_unit ?? "kg");
    setSource(product?.is_market_typical ? "piata" : "supermarket");
    setRetailerId("");
    setType("observat");
    setDate(toISODate(now()));
    setVariantId(null);
  }

  async function save() {
    const a = parseMoney(amount);
    const q = Number(quantity.replace(",", "."));
    if (!product) return setError("Alege produsul.");
    if (a == null) return setError("Scrie prețul, de exemplu 8,50.");
    if (!(q > 0)) return setError("Cantitatea trebuie să fie mai mare decât zero.");
    const ok = await run(async (ctx) => {
      let rid = retailerId || null;
      if (retailerId === "_nou") {
        if (!newPlace.trim()) throw new UserError("Scrie numele pieței sau al producătorului.");
        rid = await createRetailer(ctx, { name: newPlace, kind: source === "producator" ? "producator" : source === "piata" ? "piata" : "alta" });
      }
      await recordPrice(ctx, { product_id: product.id, amount: a, quantity: q, unit, source, retailer_id: rid, price_type: type, observed_on: date, variant_id: variantsEnabled ? variantId : null });
      return true;
    }, "Prețul a fost salvat.");
    if (ok) setAdding(false);
  }

  const placeOptions = data.retailers.filter((r) => (source === "supermarket" ? !["piata", "producator"].includes(r.kind) : source === "alta" ? true : r.kind === source));

  return (
    <>
      <div className="mb-4 flex items-center gap-1">
        <Link href="/buget/" aria-label="Înapoi la buget" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Prețuri</h1>
      </div>
      <p className="mb-3 text-sm text-ink-2">
        Prețurile sunt cele plătite sau văzute de gospodăria ta. Aplicația nu preia prețuri din magazine și nu afișează prețuri oficiale.
      </p>

      <ProductSearch placeholder="Caută un produs (ex. roșii)" onPick={({ product: p }) => p && setProduct(p)} />

      {product ? (
        <>
          <div className="mt-4 flex items-center justify-between gap-2">
            <div>
              <h2 className="font-serif text-xl font-semibold leading-snug">{product.name}</h2>
              <p className="text-xs text-ink-2">Comparație pe {unitLabel(product.default_unit, 1)}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setProduct(null)}>
                Toate
              </Button>
              <Button size="sm" icon={<Plus size={16} />} onClick={openAdd}>
                Preț
              </Button>
            </div>
          </div>

          {view.compare.length === 0 ? (
            <EmptyState icon={<Tags size={28} />} title="Niciun preț încă" action={<Button onClick={openAdd}>Adaugă un preț</Button>}>
              Prețurile apar automat după ce finalizezi cumpărăturile cu prețuri introduse, sau le poți nota aici (ex. de la piață).
            </EmptyState>
          ) : (
            <>
              {view.brands.length > 0 && (
                <>
                  <SectionTitle>{view.brands.every((r) => r.unit === "l") ? "Prețul pe litru, pe mărci" : "Prețul pe kg, pe mărci"}</SectionTitle>
                  <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                    {view.brands.map((r) => {
                      const p = data.prices.find((x) => x.id === r.price_id)!;
                      return (
                        <li key={r.variant_id ?? "_"} className="flex items-center gap-3 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px]">{view.variantName(r.variant_id) ?? "Fără marcă anume"}</p>
                            <p className="text-xs text-ink-2">
                              <span>{formatShortDate(r.observed_on)}</span> · {view.place(p)} {r.promo && <span className={`${STAMP} text-accent`}>promoție</span>} {r.stale && <span className={`${STAMP} text-ink-2`}>preț vechi</span>}
                            </p>
                          </div>
                          <span className="font-medium">
                            {formatRon(r.per)}/{r.unit}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
              <SectionTitle>Cel mai recent preț, pe locuri</SectionTitle>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {view.compare.map(({ p, unitPrice }, k) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px]">
                        {view.place(p)} {k === 0 && view.compare.length > 1 && unitPrice != null && <span className={`${STAMP} text-brand`}>cel mai bun</span>}
                      </p>
                      <p className="text-xs text-ink-2">
                        <span>{formatShortDate(p.observed_on)}</span> · {TYPE_LABELS[p.price_type]} · {SOURCE_LABELS[p.source]}
                      </p>
                      {view.receiptName(p) && <p className="text-xs text-ink-2">pe bon: {view.receiptName(p)}</p>}
                    </div>
                    <span className="text-right">
                      <span className="block font-medium">{unitPrice != null ? `${formatRon(unitPrice)}/${unitLabel(product.default_unit, 1)}` : formatRon(p.amount)}</span>
                      {unitPrice == null && <span className="text-xs text-ink-2">pentru {p.quantity.toLocaleString("ro-RO")} {unitLabel(p.unit, p.quantity)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
              <SectionTitle>Istoric</SectionTitle>
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {view.history.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1 text-sm">
                      <p>
                        <span>{formatShortDate(p.observed_on)}</span> · {view.place(p)}
                        {view.variantName(p.variant_id) && ` · ${view.variantName(p.variant_id)}`}
                      </p>
                      <p className="text-xs text-ink-2">
                        <span>
                          {formatRon(p.amount)} pentru {p.quantity.toLocaleString("ro-RO")} {unitLabel(p.unit, p.quantity)}
                        </span>{" "}
                        · {TYPE_LABELS[p.price_type]}
                      </p>
                      {view.receiptName(p) && <p className="text-xs text-ink-2">pe bon: {view.receiptName(p)}</p>}
                    </div>
                    <span className="text-sm">{perUnit(p, product.default_unit) != null ? formatRon(perUnit(p, product.default_unit)) : ""}</span>
                    {!p.transaction_item_id && (
                      <IconButton label="Șterge prețul" onClick={() => run((ctx) => deletePrice(ctx, p.id))}>
                        <Trash2 size={16} />
                      </IconButton>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <>
          <SectionTitle>Prețuri recente</SectionTitle>
          {view.recent.length === 0 ? (
            <EmptyState icon={<Tags size={28} />} title="Niciun preț încă">
              Caută un produs mai sus ca să-i notezi prețul. Prețurile plătite în magazin se salvează singure când finalizezi cumpărăturile.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
              {view.recent.map((p) => {
                const prod = data.products.get(p.product_id);
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => prod && setProduct(prod)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ease-out hover:bg-surface-2 active:bg-surface-2">
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="text-[15px]">{prod?.name ?? "Produs șters"}</p>
                        <p className="text-xs text-ink-2">
                          <span>{formatShortDate(p.observed_on)}</span> · {view.place(p)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm">
                        {formatRon(p.amount)} / {p.quantity.toLocaleString("ro-RO")} {unitLabel(p.unit, p.quantity)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}

      <Sheet open={adding} onClose={() => setAdding(false)} title={`Preț pentru ${product?.name ?? ""}`} footer={<Button block onClick={save} disabled={busy}>Salvează prețul</Button>}>
        <div className="flex flex-col gap-4">
          {variantsEnabled && product && (
            <VariantPicker
              variants={view.productVariants}
              brands={data.brands}
              value={variantId}
              onChange={(id) => {
                setVariantId(id);
                // Cu gramajul cunoscut, prețul e de obicei pe un pachet.
                if (id && data.variants.find((v) => v.id === id)?.net_quantity) {
                  setQuantity("1");
                  setUnit("pachet");
                }
              }}
              onCreate={async (input) => (await run((ctx) => createVariant(ctx, { ...input, product_id: product.id }), "Am adăugat varianta.")) ?? null}
            />
          )}
          <div className="grid grid-cols-[1fr_1fr_7rem] gap-2">
            <LabeledInput label="Prețul (lei)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="8,50" autoFocus error={error} />
            <LabeledInput label="pentru" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <LabeledSelect label="unitate" value={unit} onChange={(e) => setUnit(e.target.value as UnitCode)}>
              {SHOPPING_UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u, 2)}
                </option>
              ))}
            </LabeledSelect>
          </div>
          <Segmented<PurchaseSource>
            label="De unde"
            value={source}
            onChange={(v) => {
              setSource(v);
              setRetailerId("");
            }}
            options={(["supermarket", "piata", "producator", "alta"] as PurchaseSource[]).map((s) => ({ value: s, label: s === "producator" ? "Producător" : SOURCE_LABELS[s] }))}
          />
          <LabeledSelect label={source === "supermarket" ? "Magazinul" : source === "piata" ? "Piața" : source === "producator" ? "Producătorul" : "Locul"} value={retailerId} onChange={(e) => setRetailerId(e.target.value)}>
            <option value="">Nu contează</option>
            {placeOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
            {source !== "supermarket" && <option value="_nou">+ Adaugă {source === "piata" ? "o piață" : source === "producator" ? "un producător" : "un loc"} nou</option>}
          </LabeledSelect>
          {retailerId === "_nou" && <LabeledInput label="Numele" value={newPlace} onChange={(e) => setNewPlace(e.target.value)} placeholder={source === "piata" ? "ex. Piața Obor" : "ex. Ion, ouă de țară din Bran"} maxLength={80} />}
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <LabeledSelect label="Tipul" value={type} onChange={(e) => setType(e.target.value as PriceType)}>
              <option value="observat">Văzut la raft/tarabă</option>
              <option value="platit">Plătit</option>
              <option value="promotie">Promoție</option>
              <option value="estimat">Estimarea mea</option>
            </LabeledSelect>
          </div>
        </div>
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <PricesScreen />
    </AppShell>
  );
}
