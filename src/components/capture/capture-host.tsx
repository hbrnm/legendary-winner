"use client";

import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { BasketIcon, Camera, ChevronDown, Copy, PurseIcon, ReceiptIcon } from "@/components/ui/icons";
import { useAction, useData } from "@/components/app/hooks";
import { useApp } from "@/components/app/app-provider";
import { AddButton, Button } from "@/components/ui/button";
import { Input, LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/misc";
import { ProductSearch } from "@/components/shopping/product-search";
import { createExpense } from "@/lib/services/expenses";
import { addItem, createList } from "@/lib/services/shopping";
import { owned, visible } from "@/lib/services/queries";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "@/lib/domain/expense-categories";
import { parseMoney } from "@/lib/domain/money";
import { formatShortDate, toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { PurchaseSource, UnitCode } from "@/lib/domain/types";
import { capturePlaces, shortcutCategory, type ExpenseShortcut, actionContext } from "./model";
import { PantryItemSheet } from "@/components/pantry/pantry-item-sheet";
import { ListActionsSheet } from "@/components/shopping/list-actions-sheet";
import { ListImportSheet } from "@/components/shopping/list-import-sheet";
import { useActiveShoppingList } from "@/components/shopping/active-list-provider";
import { dispatchCapture, type CaptureRequest } from "./events";

const ReceiptCapture = lazy(() => import("@/components/shopping/receipt-capture").then(m => ({ default: m.ReceiptCapture })));
const SHORTCUTS: { id: ExpenseShortcut; name: string }[] = [
  { id: "supermarket", name: "Supermarket" }, { id: "piata", name: "Piață" },
  { id: "locuinta", name: "Casă & Utilități" }, { id: "altele", name: "Altele" },
];
const chip = "inline-flex shrink-0 items-center rounded-full text-sm focus-visible:outline-2 focus-visible:outline-brand focus-visible:-outline-offset-2 transition-colors duration-150 ease-out";
const compactChip = `${chip} min-h-11 px-3`;

/** One capture host per visible application shell; every entry point uses it. */
export function CaptureHost({ inlineTarget }: { inlineTarget?: HTMLElement | null } = {}) {
  const { familyBudgetEnabled, ctx } = useApp();
  const { run, busy } = useAction();
  const router = useRouter();
  const pathname = usePathname();
  const context = actionContext(pathname);
  const {activeListId,selectList,ready} = useActiveShoppingList();
  const [pantryOpen,setPantryOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const creatingList = useRef(false);
  const [captureVersion,setCaptureVersion] = useState(0);
  const [cameraFile,setCameraFile] = useState<File|null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const [request, setRequest] = useState<CaptureRequest | null>(null);
  const [menu, setMenu] = useState(false);
  const [amount, setAmount] = useState("");
  const [place, setPlace] = useState("");
  const [retailerId, setRetailerId] = useState<string | null>(null);
  const [freePlace, setFreePlace] = useState(false);
  const [source, setSource] = useState<PurchaseSource | null>(null);
  const [shortcut, setShortcut] = useState<ExpenseShortcut | null>(null);
  const [category, setCategory] = useState<ExpenseCategoryId>("altele");
  const [note, setNote] = useState("");
  const today = toISODate(now());
  const [date, setDate] = useState(today);
  const [showDate, setShowDate] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [listId, setListId] = useState("");
  const [error, setError] = useState<"amount" | "date" | null>(null);
  const expenseFormId = useId();
  const amountInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const data = useData(async ctx => {
    const [retailers, expenses, lists] = await Promise.all([
      visible(ctx.db, "retailers", ctx.householdId), owned(ctx.db, "manual_expenses", ctx.householdId), owned(ctx.db, "shopping_lists", ctx.householdId),
    ]);
    return { householdId:ctx.householdId, places: capturePlaces(retailers, expenses), lists: lists.filter(l => !l.archived_at).sort((a,b) => b.updated_at.localeCompare(a.updated_at)) };
  });

  const safeData = data?.householdId === ctx?.householdId ? data : undefined;
  const openCapture = useCallback((detail:CaptureRequest,file?:File)=>{
      if (!detail || !["manual", "scan", "shopping"].includes(detail.mode) || saving.current) return;
      setCameraFile(file??null);setCaptureVersion(version=>version+1);
      if (detail.mode === "manual" && detail.listId) {
        setMenu(false); setRequest(null);
        window.dispatchEvent(new CustomEvent("camara:checkout", {detail:{listId:detail.listId}}));
        return;
      }
      setMenu(false); setRequest(detail); setError(null); setAmount(""); setPlace(""); setRetailerId(null);
      setFreePlace(false); setSource(null); setCategory("altele"); setShortcut(null); setNote(""); setDate(toISODate(now())); setListId(detail.listId ?? "");
      setShowDate(false); setShowDetails(false);
  },[]);
  useEffect(() => {
    const open=(event:Event)=>openCapture((event as CustomEvent<CaptureRequest>).detail);
    window.addEventListener("camara:capture", open);
    return () => window.removeEventListener("camara:capture", open);
  }, [openCapture]);

  useEffect(()=>{
    const open=menu||request!==null||pantryOpen||copyOpen||importOpen;
    if(wasOpen.current&&!open){
      const frame=requestAnimationFrame(()=>{if(!document.querySelector('dialog[open]'))fabRef.current?.focus();});
      wasOpen.current=open;
      return ()=>cancelAnimationFrame(frame);
    }
    wasOpen.current=open;
  },[menu,request,pantryOpen,copyOpen,importOpen]);

  const createDatedList = useCallback(async () => {
    if (creatingList.current) return;
    creatingList.current = true;
    setMenu(false);
    try {
      const datedName = `Cumpărături ${formatShortDate(toISODate(now()))}`;
      const newId = await run((ctx) => createList(ctx, { name: datedName }), "Am creat lista.");
      if (newId) {
        selectList(newId);
        router.push(`/cumparaturi/lista/?id=${newId}`);
      }
    } finally {
      creatingList.current = false;
    }
  }, [run, selectList, router]);

  useEffect(() => {
    const openCopy = () => setCopyOpen(true);
    const createNew = () => void createDatedList();
    window.addEventListener("camara:list-copy", openCopy);
    window.addEventListener("camara:list-new", createNew);
    return () => {
      window.removeEventListener("camara:list-copy", openCopy);
      window.removeEventListener("camara:list-new", createNew);
    };
  }, [createDatedList]);

  function close() { if (!saving.current) { setRequest(null); setCameraFile(null); setError(null); } }
  async function saveExpense() {
    if (saving.current || !familyBudgetEnabled) return;
    const value = parseMoney(amount);
    if (value == null || value <= 0) {
      setError("amount");
      amountInput.current?.focus();
      return;
    }
    if (!date || date > today) {
      setError("date");
      setShowDate(true);
      document.getElementById(`${expenseFormId}-date`)?.focus();
      return;
    }
    setError(null);
    const description = note.trim() || place.trim() || EXPENSE_CATEGORIES.find(c => c.id === category)!.name;
    saving.current = true;
    try {
      const ok = await run(async ctx => {
        await createExpense(ctx, { amount: value, description, spent_on: date, category_id: category, place_name: place.trim() || null, retailer_id: retailerId, source, note: note.trim() || null });
        return true;
      }, "Am salvat cheltuiala.");
      if (ok) {setRequest(null);setCameraFile(null);setError(null);}
    } finally { saving.current = false; }
  }
  const fabLabel = context === 'recipes' ? 'Acțiuni rețete' : context === 'pantry' ? 'Adaugă în cămară' : context === 'budget' ? 'Acțiuni buget' : context === 'shopping' ? 'Acțiuni cumpărături' : 'Adaugă rapid';
  const menuTitle = context === 'recipes' ? 'Rețete' : context === 'budget' ? 'Buget' : context === 'shopping' ? 'Cumpărături' : 'Adaugă rapid';
  const trigger = context && !request && !menu && !pantryOpen && !copyOpen && !importOpen && (
    <AddButton
      ref={fabRef}
      aria-label={fabLabel}
      onClick={() => context === "pantry" ? setPantryOpen(true) : setMenu(true)}
    />
  );
  return <>
    <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" tabIndex={-1} aria-hidden="true" data-testid="camera-rapida" onChange={e=>{
      const file=e.target.files?.[0];e.target.value='';
      if(!file)return;
      openCapture({mode:'scan'},file);
    }}/>
    {inlineTarget ? createPortal(trigger, inlineTarget) : inlineTarget === undefined && trigger}
    {pantryOpen&&<PantryItemSheet onClose={()=>setPantryOpen(false)}/>}
    {copyOpen&&<ListActionsSheet open={copyOpen} onClose={()=>setCopyOpen(false)}/>}
    {importOpen&&<ListImportSheet open={importOpen} onClose={()=>setImportOpen(false)}/>}
    <Sheet open={menu} onClose={() => setMenu(false)} title={menuTitle}>
      <div className="flex flex-col gap-3">
        {context==='recipes'?<>
          <Button block onClick={()=>{setMenu(false);router.push('/retete/editare/');}}>Adaugă rețetă nouă</Button>
          <Button block variant="secondary" onClick={()=>{setMenu(false);router.push('/retete/import/');}}>Importă rețetă</Button>
        </>:context==='shopping'?<>
          {pathname.startsWith("/cumparaturi/lista") && (
            <Button block variant="secondary" icon={<BasketIcon size={20} />} onClick={() => dispatchCapture({mode:"shopping",listId:new URLSearchParams(window.location.search).get("id")??undefined})}>Adaugă pe listă</Button>
          )}
          <Button block onClick={createDatedList}>Listă nouă</Button>
          <Button block variant="secondary" icon={<Copy size={18} />} onClick={()=>{setMenu(false);setCopyOpen(true);}}>Copiază o listă mai veche</Button>
          <Button block variant="secondary" onClick={()=>{setMenu(false);setImportOpen(true);}}>Importă listă</Button>
        </>:<>
          {context!=='budget'&&<Button block variant="secondary" icon={<BasketIcon size={20} />} onClick={() => dispatchCapture({mode:"shopping",listId:pathname.startsWith("/cumparaturi/lista") ? new URLSearchParams(window.location.search).get("id")??undefined : undefined})}>Adaugă pe listă</Button>}
          <Button block icon={<PurseIcon size={20} />} onClick={() => dispatchCapture({mode:"manual"})}>Adaugă cheltuială</Button>
          {context==='budget'?<Button block variant="secondary" onClick={()=>{setMenu(false);window.dispatchEvent(new Event('camara:income'));}}>Adaugă venit</Button>:context==='home'&&<Button block variant="secondary" icon={<Camera size={20} />} onClick={() => {cameraInput.current?.click();setMenu(false);}}>Scanează bon</Button>}
        </>}
      </div>
    </Sheet>
    <Sheet
      open={request !== null}
      onClose={close}
      title={request?.mode === "shopping" ? "Adaugă pe listă" : "Cheltuială"}
      compact={request?.mode === "manual"}
      footer={
        request?.mode === "manual" ? (
          <Button block type="submit" form={expenseFormId} disabled={busy || !familyBudgetEnabled}>
            Salvează
          </Button>
        ) : undefined
      }
    >
      {request?.mode === "scan" && <div className="mb-4 flex rounded-full bg-surface-2 p-1" role="group" aria-label="Metoda de înregistrare">
        <button type="button" aria-pressed={false} className={`${chip} min-h-12 flex-1 justify-center px-4 text-ink-2`} disabled={busy} onClick={() => {setCameraFile(null);if(request.listId) dispatchCapture({mode:"manual",listId:request.listId}); else setRequest({...request,mode:"manual"});}}>Introducere manuală</button>
        <button type="button" aria-pressed={true} className={`${chip} min-h-12 flex-1 justify-center bg-brand px-4 text-brand-ink`} disabled={busy}><ReceiptIcon size={17} className="mr-1" /> Scanează bon</button>
      </div>}
      {request?.mode === "manual" && <form id={expenseFormId} noValidate onSubmit={e => {e.preventDefault(); void saveExpense();}} className="flex flex-col gap-2.5 sm:gap-3">
        {!familyBudgetEnabled && <p role="status" className="text-sm text-ink-2">Cheltuielile familiei vor fi disponibile după actualizarea și sincronizarea gospodăriei.</p>}
        <div className="space-y-1">
          <label htmlFor={`${expenseFormId}-amount`} className="text-sm font-medium text-ink-2">Sumă (RON)</label>
          <Input ref={amountInput} id={`${expenseFormId}-amount`} autoFocus inputMode="decimal" enterKeyHint="next" value={amount}
            onChange={e => { setAmount(e.target.value); if (error === "amount") setError(null); }}
            onKeyDown={e => {
              if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
              e.preventDefault();
              document.getElementById(`${expenseFormId}-category`)?.focus();
            }}
            placeholder="0,00" className="h-12! text-[32px] font-semibold leading-tight tabular-nums sm:h-14!" aria-invalid={error === "amount" || undefined}
            aria-describedby={error === "amount" ? `${expenseFormId}-amount-error` : undefined} />
          {error === "amount" && <p id={`${expenseFormId}-amount-error`} role="alert" className="text-sm text-accent">Scrie o sumă mai mare decât zero, cu cel mult două zecimale.</p>}
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-ink-2">Categorie</p>
          <div className="flex gap-1.5 overflow-x-auto py-0.5" role="group" aria-label="Categorii rapide">
            {SHORTCUTS.map(s => <button type="button" key={s.id} aria-pressed={shortcut === s.id} className={`${compactChip} ${shortcut === s.id ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink"}`} onClick={() => {setShortcut(s.id);setCategory(shortcutCategory(s.id));if(s.id === "supermarket" || s.id === "piata") setSource(s.id);}}>{s.name}</button>)}
          </div>
          <LabeledSelect id={`${expenseFormId}-category`} label="Toate categoriile" className="min-h-11! py-2!" value={category} onChange={e => {setCategory(e.target.value as ExpenseCategoryId);setShortcut(null);}}>{EXPENSE_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</LabeledSelect>
        </div>
        <div className="flex flex-wrap items-center gap-x-2">
          <Button size="auto" variant="secondary" aria-label={`Schimbă data plății (${date === today ? "Azi" : date ? formatShortDate(date) : "fără dată"})`} aria-expanded={showDate} onClick={() => setShowDate(!showDate)}>
            {date === today ? "Azi" : date ? formatShortDate(date) : "Alege data"}<ChevronDown size={16} aria-hidden />
          </Button>
          <Button size="auto" variant="ghost" aria-expanded={showDetails} onClick={() => setShowDetails(!showDetails)}>Mai multe detalii <ChevronDown size={16} className={showDetails ? "rotate-180" : undefined} aria-hidden /></Button>
        </div>
        {showDate && <LabeledInput id={`${expenseFormId}-date`} label="Data plății" type="date" autoFocus max={today} value={date} className="h-11! min-w-0" onChange={e => {setDate(e.target.value); if (error === "date") setError(null);}} error={error === "date" ? "Alege data plății, până astăzi." : undefined} />}
        {showDetails && <div className="space-y-2">
          <div><p className="text-sm font-medium text-ink-2">Magazin / Loc</p><div className="flex gap-1.5 overflow-x-auto py-1">
            {safeData?.places.map(p => <button type="button" key={p.key} aria-pressed={place === p.name} className={`${compactChip} ${place === p.name ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink"}`} onClick={() => {setPlace(p.name);setRetailerId(p.retailerId);setSource(p.source);setFreePlace(false);}}>{p.name}</button>)}
            <button type="button" className={`${compactChip} bg-surface-2 text-ink`} onClick={() => {setFreePlace(true);setRetailerId(null);setPlace("");}}>+ Alt loc</button>
          </div>{freePlace && <LabeledInput label="Numele locului" value={place} onChange={e => setPlace(e.target.value)} maxLength={120} className="h-11!" autoFocus />}</div>
          <LabeledInput label="Notă scurtă (opțional)" placeholder="legume și brânză" maxLength={120} value={note} onChange={e => setNote(e.target.value)} className="h-11!" enterKeyHint="done" />
        </div>}
        <Button size="auto" variant="ghost" className="self-start" icon={<ReceiptIcon size={17} />} disabled={busy} onClick={() => setRequest({...request,mode:"scan"})}>Scanează bon</Button>
      </form>}
      {request?.mode === "scan" && <Suspense fallback={<Spinner />}><ReceiptCapture key={captureVersion} embedded initialFile={cameraFile??undefined} autoRead={!!cameraFile} initialListId={request.listId} onSaved={savedListId => {setRequest(null); setCameraFile(null); if(savedListId) router.push(`/cumparaturi/lista/?id=${savedListId}`);}} /></Suspense>}
      {request?.mode === "shopping" && <div className="space-y-4">
        <LabeledSelect disabled={!ready || !safeData} label="Lista de cumpărături" value={listId || (activeListId ?? safeData?.lists[0]?.id) || ""} onChange={e => {setListId(e.target.value);selectList(e.target.value);}}>{safeData?.lists.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}<option value="nou">+ Listă nouă</option></LabeledSelect>
        {ready && safeData ? <ProductSearch autoFocus inline placeholder="Adaugă pe listă: ex. lapte" onPick={picked => { if (saving.current) return; saving.current = true; void run(async ctx => {const chosen = listId === "nou" ? null : listId || (activeListId ?? safeData?.lists[0]?.id); const id = chosen || await createList(ctx,{name:"Cumpărături"}); await addItem(ctx,id,{product_id:picked.product?.id ?? null,name:picked.product ? undefined : picked.parsed.text,quantity:picked.parsed.quantity,unit:picked.parsed.unit as UnitCode | null}); return id;},"Am adăugat produsul pe listă.").then(id => {if(id) {setRequest(null);router.push(`/cumparaturi/lista/?id=${id}`);}}).finally(() => {saving.current=false;});}} /> : <Spinner />}
      </div>}
    </Sheet>
  </>;
}
