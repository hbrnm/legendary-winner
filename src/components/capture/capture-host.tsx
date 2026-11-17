"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Camera, Plus, Receipt, ShoppingBasket, Wallet } from "lucide-react";
import { useAction, useData } from "@/components/app/hooks";
import { useApp } from "@/components/app/app-provider";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/misc";
import { ProductSearch } from "@/components/shopping/product-search";
import { createExpense } from "@/lib/services/expenses";
import { addItem, createList } from "@/lib/services/shopping";
import { owned, visible } from "@/lib/services/queries";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "@/lib/domain/expense-categories";
import { parseMoney } from "@/lib/domain/money";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { PurchaseSource, UnitCode } from "@/lib/domain/types";
import { capturePlaces, shortcutCategory, type ExpenseShortcut } from "./model";
import { dispatchCapture, type CaptureRequest } from "./events";

const ReceiptCapture = lazy(() => import("@/components/shopping/receipt-capture").then(m => ({ default: m.ReceiptCapture })));
const SHORTCUTS: { id: ExpenseShortcut; name: string }[] = [
  { id: "supermarket", name: "Supermarket" }, { id: "piata", name: "Piață" },
  { id: "locuinta", name: "Casă & Utilități" }, { id: "altele", name: "Altele" },
];
const chip = "inline-flex min-h-12 shrink-0 items-center rounded-full px-4 text-sm focus-visible:outline-2 focus-visible:outline-brand";

/** One capture host per visible application shell; every entry point uses it. */
export function CaptureHost() {
  const { familyBudgetEnabled } = useApp();
  const { run, busy } = useAction();
  const router = useRouter();
  const pathname = usePathname();
  const [request, setRequest] = useState<CaptureRequest | null>(null);
  const [menu, setMenu] = useState(false);
  const [keyboard, setKeyboard] = useState(false);
  const [amount, setAmount] = useState("");
  const [place, setPlace] = useState("");
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [freePlace, setFreePlace] = useState(false);
  const [source, setSource] = useState<PurchaseSource | null>(null);
  const [shortcut, setShortcut] = useState<ExpenseShortcut | null>(null);
  const [category, setCategory] = useState<ExpenseCategoryId>("altele");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(toISODate(now()));
  const [listId, setListId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const data = useData(async ctx => {
    const [retailers, expenses, lists] = await Promise.all([
      visible(ctx.db, "retailers", ctx.householdId), owned(ctx.db, "manual_expenses", ctx.householdId), owned(ctx.db, "shopping_lists", ctx.householdId),
    ]);
    return { places: capturePlaces(retailers, expenses), lists: lists.filter(l => !l.archived_at).sort((a,b) => b.updated_at.localeCompare(a.updated_at)) };
  });

  useEffect(() => {
    const open = (event: Event) => {
      const detail = (event as CustomEvent<CaptureRequest>).detail;
      if (!detail || !["manual", "scan", "shopping"].includes(detail.mode) || saving.current) return;
      if (detail.mode === "manual" && detail.listId) {
        setMenu(false); setRequest(null);
        window.dispatchEvent(new CustomEvent("camara:checkout", {detail:{listId:detail.listId}}));
        return;
      }
      setMenu(false); setRequest(detail); setError(null); setAmount(""); setPlace(""); setRetailerId(null);
      setFreePlace(false); setSource(null); setCategory("altele"); setShortcut(null); setNote(""); setDate(toISODate(now())); setListId(detail.listId ?? "");
    };
    window.addEventListener("camara:capture", open);
    return () => window.removeEventListener("camara:capture", open);
  }, []);
  useEffect(() => {
    const update = () => setKeyboard(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement || Boolean(window.visualViewport && window.innerHeight - window.visualViewport.height > 140));
    document.addEventListener("focusin", update); document.addEventListener("focusout", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => { document.removeEventListener("focusin", update); document.removeEventListener("focusout", update); window.visualViewport?.removeEventListener("resize", update); };
  }, []);

  function close() { if (!saving.current) { setRequest(null); setError(null); } }
  async function saveExpense() {
    if (saving.current) return;
    const value = parseMoney(amount);
    if (value == null || value <= 0) return setError("Scrie o sumă mai mare decât zero, cu cel mult două zecimale.");
    if (!date || date > toISODate(now())) return setError("Alege data plății, până astăzi.");
    const description = note.trim() || place.trim() || EXPENSE_CATEGORIES.find(c => c.id === category)!.name;
    saving.current = true;
    try {
      const ok = await run(async ctx => {
        await createExpense(ctx, { amount: value, description, spent_on: date, category_id: category, place_name: place.trim() || null, retailer_id: retailerId, source, note: note.trim() || null });
        return true;
      }, "Am salvat cheltuiala.");
      if (ok) setRequest(null);
    } finally { saving.current = false; }
  }
  const mainScreen = ["/", "/retete/", "/camara/", "/cumparaturi/", "/buget/"].includes(pathname);
  return <>
    {mainScreen && !request && !menu && !keyboard && <button type="button" className="capture-fab focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand" aria-label="Adaugă rapid" onClick={() => setMenu(true)}><Plus size={28} /></button>}
    <Sheet open={menu} onClose={() => setMenu(false)} title="Adaugă rapid">
      <div className="flex flex-col gap-3">
        <Button block variant="secondary" icon={<ShoppingBasket size={20} />} onClick={() => dispatchCapture({mode:"shopping"})}>Adaugă pe listă</Button>
        <Button block icon={<Wallet size={20} />} onClick={() => dispatchCapture({mode:"manual"})}>Adaugă cheltuială</Button>
        <Button block variant="secondary" icon={<Camera size={20} />} onClick={() => dispatchCapture({mode:"scan"})}>Scanează bon</Button>
      </div>
    </Sheet>
    <Sheet open={request !== null} onClose={close} title={request?.mode === "shopping" ? "Adaugă pe listă" : "Cheltuială"}
      footer={request?.mode === "manual" ? <Button block disabled={busy || !familyBudgetEnabled} onClick={saveExpense}>Salvează</Button> : undefined}>
      {request?.mode !== "shopping" && <div className="mb-5 flex rounded-full bg-surface-2 p-1" role="group" aria-label="Metoda de înregistrare">
        <button type="button" aria-pressed={request?.mode === "manual"} className={`${chip} flex-1 justify-center ${request?.mode === "manual" ? "bg-brand text-brand-ink" : "text-ink-2"}`} disabled={busy} onClick={() => {if(request?.listId) dispatchCapture({mode:"manual",listId:request.listId}); else setRequest(r => r && {...r,mode:"manual"});}}>Introducere manuală</button>
        <button type="button" aria-pressed={request?.mode === "scan"} className={`${chip} flex-1 justify-center ${request?.mode === "scan" ? "bg-brand text-brand-ink" : "text-ink-2"}`} disabled={busy} onClick={() => setRequest(r => r && {...r,mode:"scan"})}><Receipt size={17} className="mr-1" /> Scanează bon</button>
      </div>}
      {request?.mode === "manual" && <form onSubmit={e => {e.preventDefault(); void saveExpense();}} className="flex flex-col gap-4">
        {!familyBudgetEnabled && <p role="status" className="text-sm text-ink-2">Cheltuielile familiei vor fi disponibile după actualizarea și sincronizarea gospodăriei.</p>}
        <label className="block text-sm font-medium">Sumă (RON)<input autoFocus data-autofocus inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" className="mt-1 block h-16 w-full border-b border-line bg-transparent text-4xl font-semibold tabular-nums outline-none focus:border-brand" /></label>
        <div><p className="mb-2 text-sm font-medium">Magazin / Loc</p><div className="flex gap-2 overflow-x-auto pb-1">
          {data?.places.map(p => <button type="button" key={p.key} aria-pressed={place === p.name} className={`${chip} ${place === p.name ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink"}`} onClick={() => {setPlace(p.name);setRetailerId(p.retailerId);setSource(p.source);setFreePlace(false);}}>{p.name}</button>)}
          <button type="button" className={`${chip} bg-surface-2 text-ink`} onClick={() => {setFreePlace(true);setRetailerId(null);setPlace("");}}>+ Alt loc</button>
        </div>{freePlace && <LabeledInput label="Numele locului" value={place} onChange={e => setPlace(e.target.value)} maxLength={120} autoFocus />}</div>
        <div><p className="mb-2 text-sm font-medium">Categorie</p><div className="flex gap-2 overflow-x-auto pb-1">{SHORTCUTS.map(s => <button type="button" key={s.id} aria-pressed={shortcut === s.id} className={`${chip} ${shortcut === s.id ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink"}`} onClick={() => {setShortcut(s.id);setCategory(shortcutCategory(s.id));if(s.id === "supermarket" || s.id === "piata") setSource(s.id);}}>{s.name}</button>)}</div></div>
        <LabeledSelect label="Toate categoriile" value={category} onChange={e => {setCategory(e.target.value as ExpenseCategoryId);setShortcut(null);}}>{EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</LabeledSelect>
        <LabeledInput label="Notă scurtă (opțional)" placeholder="legume și brânză" maxLength={120} value={note} onChange={e => setNote(e.target.value)} />
        <LabeledInput label="Data plății" type="date" max={toISODate(now())} value={date} onChange={e => setDate(e.target.value)} />
        {error && <p role="alert" className="text-sm text-accent">{error}</p>}
        <button type="submit" className="sr-only" disabled={busy}>Salvează cheltuiala</button>
      </form>}
      {request?.mode === "scan" && <Suspense fallback={<Spinner />}><ReceiptCapture embedded initialListId={request.listId} onSaved={savedListId => {setRequest(null); if(savedListId) router.push(`/cumparaturi/lista/?id=${savedListId}`);}} /></Suspense>}
      {request?.mode === "shopping" && <div className="space-y-4">
        <LabeledSelect label="Lista de cumpărături" value={listId || data?.lists[0]?.id || ""} onChange={e => setListId(e.target.value)}>{data?.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}<option value="nou">+ Listă nouă</option></LabeledSelect>
        <ProductSearch autoFocus inline placeholder="Adaugă pe listă: ex. lapte" onPick={picked => { if (saving.current) return; saving.current = true; void run(async ctx => {const chosen = listId === "nou" ? null : listId || data?.lists[0]?.id; const id = chosen || await createList(ctx,{name:"Cumpărături"}); await addItem(ctx,id,{product_id:picked.product?.id ?? null,name:picked.product ? undefined : picked.parsed.text,quantity:picked.parsed.quantity,unit:picked.parsed.unit as UnitCode | null}); return id;},"Am adăugat produsul pe listă.").then(id => {if(id) {setRequest(null);router.push(`/cumparaturi/lista/?id=${id}`);}}).finally(() => {saving.current=false;});}} />
      </div>}
    </Sheet>
  </>;
}
