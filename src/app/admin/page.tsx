"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Upload } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Field, LabeledInput, LabeledSelect, Segmented, Toggle } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import { ALLERGEN_LABELS } from "@/components/recipes/recipe-visual";
import { createCategory, createProduct, createRetailer, updateCategory, updateProduct, updateRetailer, deleteProduct } from "@/lib/services/catalog";
import { visible } from "@/lib/services/queries";
import { normalize } from "@/lib/domain/search";
import { parseProductImport, type ImportResult } from "@/lib/domain/csv-import";
import { UNIT_CODES, unitLabel } from "@/lib/domain/units";
import type { Allergen, Product, ProductCategory, Retailer, RetailerKind, UnitCode } from "@/lib/domain/types";

type Tab = "produse" | "categorii" | "retete" | "magazine" | "import";
const MONTHS = ["ian", "feb", "mar", "apr", "mai", "iun", "iul", "aug", "sep", "oct", "nov", "dec"];

interface ProductDraft {
  id: string | null;
  name: string;
  category_id: string;
  subcategory: string;
  default_unit: UnitCode;
  ean: string;
  is_market_typical: boolean;
  is_traditional: boolean;
  season_months: number[];
  allergens: Allergen[];
  aliases: string;
}

function AdminScreen() {
  const { isAppAdmin, mode } = useApp();
  const { run, busy } = useAction();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("produse");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ProductDraft | null>(null);
  const [cat, setCat] = useState<Partial<ProductCategory> | null>(null);
  const [ret, setRet] = useState<Partial<Retailer> | null>(null);
  const [importText, setImportText] = useState("");
  const [preview, setPreview] = useState<ImportResult | null>(null);

  const data = useData(async (ctx) => {
    const [products, categories, aliases, recipes, retailers] = await Promise.all([
      ctx.db.products.toArray(),
      visible(ctx.db, "product_categories", ctx.householdId),
      ctx.db.product_aliases.toArray(),
      ctx.db.recipes.toArray(),
      ctx.db.retailers.toArray(),
    ]);
    const global = <T extends { household_id: string | null; deleted_at: string | null }>(xs: T[]) => xs.filter((x) => x.household_id === null && !x.deleted_at);
    const aliasMap = new Map<string, string[]>();
    for (const a of global(aliases)) aliasMap.set(a.product_id, [...(aliasMap.get(a.product_id) ?? []), a.alias]);
    return {
      products: global(products).sort((a, b) => a.name.localeCompare(b.name, "ro")),
      categories: global(categories).sort((a, b) => a.sort_order - b.sort_order),
      aliasMap,
      recipes: global(recipes).sort((a, b) => a.name.localeCompare(b.name, "ro")),
      retailers: global(retailers).sort((a, b) => a.name.localeCompare(b.name, "ro")),
    };
  });

  const products = useMemo(() => {
    if (!data) return [];
    const q = normalize(query);
    return data.products.filter((p) => !q || normalize(`${p.name} ${(data.aliasMap.get(p.id) ?? []).join(" ")}`).includes(q)).slice(0, 100);
  }, [data, query]);

  if (!isAppAdmin) return <EmptyState title="Doar pentru administratori">Administrarea catalogului comun e disponibilă doar conturilor de administrator.</EmptyState>;
  if (!data) return <Spinner />;
  const catName = new Map(data.categories.map((c) => [c.id, c.name]));

  function editProduct(p: Product | null) {
    setDraft(
      p
        ? {
            id: p.id,
            name: p.name,
            category_id: p.category_id,
            subcategory: p.subcategory ?? "",
            default_unit: p.default_unit,
            ean: p.ean ?? "",
            is_market_typical: p.is_market_typical,
            is_traditional: p.is_traditional,
            season_months: p.season_months,
            allergens: p.allergens,
            aliases: (data!.aliasMap.get(p.id) ?? []).join(", "),
          }
        : { id: null, name: "", category_id: data!.categories[0]?.id ?? "diverse", subcategory: "", default_unit: "buc", ean: "", is_market_typical: false, is_traditional: false, season_months: [], allergens: [], aliases: "" },
    );
  }

  async function saveProduct() {
    const d = draft!;
    const input = {
      name: d.name,
      category_id: d.category_id,
      subcategory: d.subcategory.trim() || null,
      default_unit: d.default_unit,
      ean: d.ean.trim() || null,
      is_market_typical: d.is_market_typical,
      is_traditional: d.is_traditional,
      season_months: d.season_months,
      allergens: d.allergens,
      aliases: d.aliases.split(",").map((a) => a.trim()).filter(Boolean),
    };
    const ok = await run(async (ctx) => {
      if (d.id) await updateProduct(ctx, d.id, input);
      else {
        const slug = normalize(d.name).replace(/ /g, "-").slice(0, 60);
        await createProduct(ctx, input, { global: true, id: slug || undefined });
      }
      return true;
    }, "Produsul a fost salvat.");
    if (ok) setDraft(null);
  }

  async function runImport() {
    if (!preview) return;
    let n = 0;
    await run(async (ctx) => {
      for (const r of preview.rows) {
        const slug = normalize(r.name).replace(/ /g, "-").slice(0, 60);
        await createProduct(ctx, { name: r.name, category_id: r.category_id, default_unit: r.default_unit, ean: r.ean, is_market_typical: r.is_market_typical, aliases: r.aliases }, { global: true, id: slug });
        n++;
      }
    });
    toast(`Am importat ${n} produse.`);
    setPreview(null);
    setImportText("");
  }

  return (
    <>
      <PageHeader title="Administrare catalog" subtitle={mode === "demo" ? "Mod demonstrativ: modificările rămân pe acest dispozitiv." : "Modificările ajung la toți utilizatorii."} />
      <div className="-mx-4 overflow-x-auto px-4">
        <div className="min-w-[32rem]">
          <Segmented<Tab>
            label="Secțiune"
            value={tab}
            onChange={setTab}
            options={[
              { value: "produse", label: `Produse (${data.products.length})` },
              { value: "categorii", label: "Categorii" },
              { value: "retete", label: "Rețete" },
              { value: "magazine", label: "Magazine" },
              { value: "import", label: "Import" },
            ]}
          />
        </div>
      </div>

      {tab === "produse" && (
        <div className="mt-4">
          <div className="flex gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-surface px-3">
              <Search size={16} className="shrink-0 text-ink-3" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Caută după nume sau sinonim" aria-label="Caută produse" className="h-11 min-w-0 flex-1 bg-transparent focus:outline-none" />
            </div>
            <Button icon={<Plus size={18} />} onClick={() => editProduct(null)}>
              Produs
            </Button>
          </div>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {products.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => editProduct(p)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{p.name}</span>
                    <span className="block truncate text-xs text-ink-2">
                      {catName.get(p.category_id)} · {unitLabel(p.default_unit, 1)}
                      {(data.aliasMap.get(p.id) ?? []).length > 0 && ` · ${(data.aliasMap.get(p.id) ?? []).join(", ")}`}
                    </span>
                  </span>
                  {p.is_market_typical && <Badge tone="brand">piață</Badge>}
                </button>
              </li>
            ))}
          </ul>
          {products.length === 100 && <p className="mt-2 text-xs text-ink-2">Se arată primele 100. Caută ca să restrângi.</p>}
        </div>
      )}

      {tab === "categorii" && (
        <div className="mt-4">
          <Button icon={<Plus size={18} />} onClick={() => setCat({ name: "", icon: "tag", is_food: true, sort_order: (data.categories.length + 1) * 10 })}>
            Categorie
          </Button>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {data.categories.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setCat(c)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                  <span className="w-8 text-xs text-ink-2 tabular">{c.sort_order}</span>
                  <span className="flex-1">{c.name}</span>
                  {!c.is_food && <Badge>nealimentar</Badge>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "retete" && (
        <div className="mt-4">
          <Link href="/retete/editare/?global=1" className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand px-4 font-medium text-brand-ink">
            <Plus size={18} /> Rețetă în catalogul comun
          </Link>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {data.recipes.map((r) => (
              <li key={r.id}>
                <Link href={`/retete/editare/?id=${r.id}`} className="block px-4 py-2.5 hover:bg-surface-2">
                  {r.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "magazine" && (
        <div className="mt-4">
          <Button icon={<Plus size={18} />} onClick={() => setRet({ name: "", kind: "supermarket" })}>
            Magazin
          </Button>
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {data.retailers.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => setRet(r)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2">
                  <span className="flex-1">{r.name}</span>
                  <Badge>{r.kind}</Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "import" && (
        <Card className="mt-4 flex flex-col gap-3 p-4">
          <p className="text-sm text-ink-2">
            Import controlat de produse în catalogul comun, din CSV. Coloane: <code>nume;categorie;unitate;sinonime;ean;piata</code>. Sinonimele se separă cu „|”, piața e „da” sau „nu”. Vezi întâi
            previzualizarea; produsele existente nu se dublează. Prețurile nu se importă.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Alege fișierul CSV"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setImportText(await f.text());
            }}
            className="text-sm"
          />
          <Field label="sau lipește conținutul">
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} className="min-h-32 rounded-xl border border-line bg-surface p-3 font-mono text-xs" />
          </Field>
          <Button variant="secondary" icon={<Upload size={18} />} disabled={!importText.trim()} onClick={() => setPreview(parseProductImport(importText, data.categories, data.products.map((p) => p.name)))}>
            Previzualizează
          </Button>
          {preview && (
            <div className="flex flex-col gap-2 text-sm">
              <p>
                <strong>{preview.rows.length}</strong> produse noi · {preview.duplicates.length} existente (se sar) · {preview.errors.length} rânduri cu erori
              </p>
              {preview.errors.length > 0 && (
                <ul className="rounded-xl bg-accent-soft p-3 text-accent">
                  {preview.errors.slice(0, 20).map((e) => (
                    <li key={e.line}>
                      Rândul {e.line}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
              {preview.rows.length > 0 && (
                <Button onClick={runImport} disabled={busy}>
                  Importă {preview.rows.length} produse
                </Button>
              )}
            </div>
          )}
        </Card>
      )}

      <Sheet open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Modifică produsul" : "Produs nou"} footer={
        <div className="flex gap-2">
          {draft?.id && (
            <Button
              variant="danger"
              onClick={async () => {
                await run((ctx) => deleteProduct(ctx, draft.id!), "Produsul a fost scos din catalog.");
                setDraft(null);
              }}
            >
              Scoate
            </Button>
          )}
          <Button block onClick={saveProduct} disabled={busy}>
            Salvează
          </Button>
        </div>
      }>
        {draft && (
          <div className="flex flex-col gap-4">
            <LabeledInput label="Denumire" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} />
            <div className="grid grid-cols-2 gap-2">
              <LabeledSelect label="Categorie" value={draft.category_id} onChange={(e) => setDraft({ ...draft, category_id: e.target.value })}>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </LabeledSelect>
              <LabeledSelect label="Unitate" value={draft.default_unit} onChange={(e) => setDraft({ ...draft, default_unit: e.target.value as UnitCode })}>
                {UNIT_CODES.map((u) => (
                  <option key={u} value={u}>
                    {unitLabel(u, 2)}
                  </option>
                ))}
              </LabeledSelect>
            </div>
            <LabeledInput label="Subcategorie" value={draft.subcategory} onChange={(e) => setDraft({ ...draft, subcategory: e.target.value })} maxLength={60} />
            <LabeledInput label="Sinonime (separate prin virgulă)" value={draft.aliases} onChange={(e) => setDraft({ ...draft, aliases: e.target.value })} />
            <LabeledInput label="Cod EAN/GTIN" inputMode="numeric" value={draft.ean} onChange={(e) => setDraft({ ...draft, ean: e.target.value })} />
            <Toggle checked={draft.is_market_typical} onChange={(v) => setDraft({ ...draft, is_market_typical: v })} label="Se cumpără des la piață" />
            <Toggle checked={draft.is_traditional} onChange={(v) => setDraft({ ...draft, is_traditional: v })} label="Produs tradițional" />
            <Field label="Luni de sezon">
              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((m, k) => {
                  const on = draft.season_months.includes(k + 1);
                  return (
                    <button key={m} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, season_months: on ? draft.season_months.filter((x) => x !== k + 1) : [...draft.season_months, k + 1].sort((a, b) => a - b) })} className={`h-9 w-11 rounded-lg border text-sm ${on ? "border-brand bg-brand text-brand-ink" : "border-line"}`}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label="Alergeni">
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ALLERGEN_LABELS) as Allergen[]).map((a) => {
                  const on = draft.allergens.includes(a);
                  return (
                    <button key={a} type="button" aria-pressed={on} onClick={() => setDraft({ ...draft, allergens: on ? draft.allergens.filter((x) => x !== a) : [...draft.allergens, a] })} className={`h-9 rounded-lg border px-2.5 text-sm ${on ? "border-warn bg-warn-soft text-warn" : "border-line"}`}>
                      {ALLERGEN_LABELS[a]}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}
      </Sheet>

      <Sheet open={cat !== null} onClose={() => setCat(null)} title={cat?.id ? "Modifică categoria" : "Categorie nouă"} footer={
        <Button
          block
          onClick={async () => {
            const c = cat!;
            const input = { name: c.name ?? "", icon: c.icon ?? "tag", is_food: c.is_food ?? true, sort_order: Number(c.sort_order) || 500 };
            const ok = await run(async (ctx) => {
              if (c.id) await updateCategory(ctx, c.id, input);
              else await createCategory(ctx, input, { global: true });
              return true;
            });
            if (ok) setCat(null);
          }}
        >
          Salvează
        </Button>
      }>
        {cat && (
          <div className="flex flex-col gap-4">
            <LabeledInput label="Nume" value={cat.name ?? ""} onChange={(e) => setCat({ ...cat, name: e.target.value })} maxLength={60} />
            <LabeledInput label="Ordinea în listă (raionul)" inputMode="numeric" value={String(cat.sort_order ?? "")} onChange={(e) => setCat({ ...cat, sort_order: Number(e.target.value) })} />
            <Toggle checked={cat.is_food ?? true} onChange={(v) => setCat({ ...cat, is_food: v })} label="Alimente" description="Dezactivează pentru curățenie, igienă etc. (contează la bugetul de alimente)." />
          </div>
        )}
      </Sheet>

      <Sheet open={ret !== null} onClose={() => setRet(null)} title={ret?.id ? "Modifică magazinul" : "Magazin nou"} footer={
        <Button
          block
          onClick={async () => {
            const r = ret!;
            const input = { name: r.name ?? "", kind: (r.kind ?? "supermarket") as RetailerKind, details: null };
            const ok = await run(async (ctx) => {
              if (r.id) await updateRetailer(ctx, r.id, input);
              else await createRetailer(ctx, input, { global: true });
              return true;
            });
            if (ok) setRet(null);
          }}
        >
          Salvează
        </Button>
      }>
        {ret && (
          <div className="flex flex-col gap-4">
            <LabeledInput label="Nume" value={ret.name ?? ""} onChange={(e) => setRet({ ...ret, name: e.target.value })} maxLength={80} />
            <LabeledSelect label="Tip" value={ret.kind ?? "supermarket"} onChange={(e) => setRet({ ...ret, kind: e.target.value as RetailerKind })}>
              <option value="supermarket">Supermarket</option>
              <option value="hipermarket">Hipermarket</option>
              <option value="discount">Discount</option>
              <option value="proximitate">Magazin de proximitate</option>
              <option value="cash_carry">Cash & carry</option>
              <option value="alta">Altul</option>
            </LabeledSelect>
          </div>
        )}
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell wide>
      <AdminScreen />
    </AppShell>
  );
}
