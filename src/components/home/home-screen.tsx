"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Archive, Check, Plus, Receipt, ShoppingBasket } from "lucide-react";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { BudgetBar, Card, SectionTitle, Spinner } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { RecipeImage } from "@/components/recipes/recipe-photo";
import { SLOT_LABELS } from "@/components/recipes/recipe-visual";
import { dispatchCapture } from "@/components/capture/events";
import { projectTransactions } from "@/components/budget/transactions";
import { listItems, owned, priceIndex, householdSpendRecords, visible } from "@/lib/services/queries";
import { addItem, createList } from "@/lib/services/shopping";
import { addMeal, cookRecipe } from "@/lib/services/kitchen";
import { budgetStatus, dailyBudgetAvailable } from "@/lib/domain/budget";
import { listTotals } from "@/lib/domain/shopping";
import { expiringSoon } from "@/lib/domain/pantry";
import { totalMinutes } from "@/lib/domain/recipes";
import { formatShortDate, localDateOf, toISODate } from "@/lib/domain/dates";
import { formatRon } from "@/lib/domain/money";
import { now } from "@/lib/clock";
import type { MealSlot, Recipe, UnitCode } from "@/lib/domain/types";
import { quickMealSuggestions } from "./home-model";

const SLOT_ORDER: MealSlot[] = ["mic_dejun", "pranz", "cina", "gustare"];
export function HomeScreen() {
  const { run, busy } = useAction();
  const today = toISODate(now());
  const [mealAction, setMealAction] = useState<{kind:"plan"|"cook";recipe:Recipe}|null>(null);
  const [slot, setSlot] = useState<MealSlot>("pranz");
  const [servings, setServings] = useState(2);
  const submitting = useRef(false);
  const data = useData(async ctx => {
    const [lists, prices, budgets, spend, categories, meals, recipes, pantry, txs, retailers] = await Promise.all([
      owned(ctx.db,"shopping_lists",ctx.householdId),priceIndex(ctx.db,ctx.householdId),owned(ctx.db,"budgets",ctx.householdId),
      householdSpendRecords(ctx.db,ctx.householdId),visible(ctx.db,"product_categories",ctx.householdId),owned(ctx.db,"meal_plan_items",ctx.householdId),
      visible(ctx.db,"recipes",ctx.householdId),owned(ctx.db,"pantry_items",ctx.householdId),owned(ctx.db,"shopping_transactions",ctx.householdId),visible(ctx.db,"retailers",ctx.householdId),
    ]);
    const active = await Promise.all(lists.filter(l=>!l.archived_at).map(async list=>({list,totals:listTotals(await listItems(ctx.db,list.id),prices)})));
    const next = active.sort((a,b)=>(b.totals.item_count-b.totals.checked_count)-(a.totals.item_count-a.totals.checked_count)||b.list.updated_at.localeCompare(a.list.updated_at))[0] ?? null;
    const main=budgets.find(b=>b.active&&b.period==="lunar"&&b.scope.kind==="familie")??budgets.find(b=>b.active&&b.period==="lunar"&&(b.scope.kind==="total"||b.scope.kind==="alimente"));
    const recipesById=new Map(recipes.map(r=>[r.id,r]));
    const recent=projectTransactions(spend,txs).filter(t=>!t.pending)[0];
    return {
      next, remainingItems:active.reduce((n,a)=>n+a.totals.item_count-a.totals.checked_count,0),
      budget:main?budgetStatus(main,spend,new Map(categories.map(c=>[c.id,c])),today):null,
      meals:meals.filter(m=>m.date===today).sort((a,b)=>SLOT_ORDER.indexOf(a.slot)-SLOT_ORDER.indexOf(b.slot)).map(meal=>({meal,recipe:recipesById.get(meal.recipe_id)})),
      suggestions:quickMealSuggestions(recipes,today),stockCount:pantry.filter(p=>p.quantity>0).length,
      expiringCount:expiringSoon(pantry.filter(p=>p.quantity>0),today,3).length,
      recent:recent?{...recent,title:recent.retailerId?retailers.find(r=>r.id===recent.retailerId)?.name??recent.title:recent.title}:null,
    };
  },[today]);
  if(!data)return <Spinner />;

  async function quickAdd(productId:string|null,text:string,quantity:number|null,unit:string|null){
    if(submitting.current)return;submitting.current=true;
    try{await run(async ctx=>{const id=data!.next?.list.id??await createList(ctx,{name:"Cumpărături"});await addItem(ctx,id,{product_id:productId,name:productId?undefined:text,quantity,unit:unit as UnitCode|null});return true;},"Am adăugat produsul pe listă.");}finally{submitting.current=false;}
  }
  function openMeal(kind:"plan"|"cook",recipe:Recipe,plannedServings?:number){setMealAction({kind,recipe});setServings(plannedServings??recipe.servings);setSlot(data!.meals.some(m=>m.meal.slot==="pranz")?"cina":"pranz");}
  async function confirmMeal(){
    if(!mealAction||submitting.current||!Number.isInteger(servings)||servings<1||servings>50)return;
    submitting.current=true;
    try{
      const action=mealAction;
      const ok=await run(async ctx=>{
        if(action.kind==="cook")return cookRecipe(ctx,action.recipe.id,servings);
        await ctx.db.transaction("rw",[ctx.db.meal_plan_items,ctx.db.outbox],async()=>{
          const existing=await owned(ctx.db,"meal_plan_items",ctx.householdId);
          if(!existing.some(m=>m.date===today&&m.slot===slot&&m.recipe_id===action.recipe.id))await addMeal(ctx,{date:today,slot,recipe_id:action.recipe.id,servings});
        });return {updated:0,shortfall:[]};
      },res=>action.kind==="plan"?"Am planificat masa pentru azi.":res.shortfall.length?"Am actualizat cămara. Unele ingrediente nu aveau stoc suficient sau cantități compatibile.":"Am scăzut ingredientele din cămară.");
      if(ok)setMealAction(null);
    }finally{submitting.current=false;}
  }
  return <>
    <SectionTitle action={<Link href="/plan/" className="inline-flex min-h-12 items-center text-sm font-medium text-brand">Planul săptămânii →</Link>}>Azi la masă</SectionTitle>
    <Card className="divide-y divide-line overflow-hidden">
      {data.meals.length?data.meals.map(({meal,recipe})=><div key={meal.id} className="flex items-center gap-3 p-3">
        {recipe&&<RecipeImage recipe={recipe} size="sm" />}
        <Link href={recipe?`/retete/reteta/?id=${recipe.id}`:"/plan/"} className="min-w-0 flex-1"><span className="block text-xs text-ink-2">{SLOT_LABELS[meal.slot]} · {meal.servings} porții</span><span className="line-clamp-2 font-medium">{recipe?.name??"Rețetă indisponibilă"}</span></Link>
        {recipe&&<Button size="sm" onClick={()=>openMeal("cook",recipe,meal.servings)}>Am gătit</Button>}
      </div>):data.suggestions.length?data.suggestions.map(recipe=><div key={recipe.id} className="flex items-center gap-3 p-3">
        <RecipeImage recipe={recipe} size="sm" /><Link href={`/retete/reteta/?id=${recipe.id}`} className="min-w-0 flex-1"><span className="line-clamp-2 font-medium">{recipe.name}</span><span className="block text-xs text-ink-2">{totalMinutes(recipe)} min · {recipe.servings} porții</span></Link><Button size="sm" onClick={()=>openMeal("plan",recipe)}>Alege</Button>
      </div>):<p className="p-4 text-sm text-ink-2">Adaugă o rețetă rapidă sau <Link href="/plan/" className="font-medium text-brand">planifică masa de azi →</Link></p>}
    </Card>
    <SectionTitle>Cumpărături & Cămară</SectionTitle>
    <ProductSearch placeholder="Adaugă pe listă: ex. lapte" onPick={({product,parsed})=>void quickAdd(product?.id??null,parsed.text,parsed.quantity,parsed.unit)} />
    <div className="mt-3 grid grid-cols-2 gap-3">
      <Card className="min-w-0 p-3"><Link href={data.next?`/cumparaturi/lista/?id=${data.next.list.id}`:"/cumparaturi/"} className="block"><span className="flex items-center gap-1.5 text-sm font-medium"><ShoppingBasket size={17}/> Cumpărături</span>{data.remainingItems>0?<p className="mt-2 text-2xl font-semibold tabular-nums">{data.remainingItems}<span className="ml-2 text-xs font-normal text-ink-2">de luat</span></p>:<p className="mt-2 flex items-center gap-1 text-sm text-info"><Check size={17}/> Nimic de luat</p>}</Link><Link href="/cumparaturi/?nou=1" className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-brand">+ Listă</Link></Card>
      <Card className="min-w-0 p-3"><Link href="/camara/" className="block"><span className="flex items-center gap-1.5 text-sm font-medium"><Archive size={17}/> Cămară</span><p className="mt-2 text-lg font-semibold tabular-nums">{data.stockCount} în stoc</p><p className={`mt-1 text-xs ${data.expiringCount?"text-accent":"text-info"}`}>{data.expiringCount?`${data.expiringCount} expiră curând`:"Totul e în termen"}</p></Link></Card>
    </div>
    <SectionTitle>Bugetul lunii</SectionTitle>
    <Card className="p-4">
      {data.budget?<>
        <Link href="/buget/" className="block"><p className={`text-2xl font-semibold tabular-nums ${data.budget.over?"text-accent":""}`}>{formatRon(Math.abs(data.budget.remaining))} <span className="text-sm font-normal">{data.budget.over?"peste buget":"rămași"}</span></p><p className="mt-1 text-xs text-ink-2">din {formatRon(data.budget.budget.amount)}</p></Link>
        {data.budget.remaining>=0&&<p className="mb-3 mt-2 text-sm text-ink-2">~{formatRon(dailyBudgetAvailable(data.budget.remaining,today))}/zi disponibili până la finalul lunii</p>}
        <BudgetBar pct={data.budget.used_pct} label="Bugetul lunii folosit" />
      </>:<Link href="/buget/" className="inline-flex min-h-12 items-center text-brand">Setează plafonul lunar →</Link>}
      <div className="mt-4 grid grid-cols-2 gap-2"><Button className="px-2! text-sm" icon={<Plus size={17}/>} onClick={()=>dispatchCapture({mode:"manual"})}>Cheltuială</Button><Button className="px-2! text-sm" variant="secondary" icon={<Receipt size={17}/>} onClick={()=>dispatchCapture({mode:"scan"})}>Scanează bon</Button></div>
      <div className="mt-3 flex min-h-11 items-center gap-2 border-t border-line pt-2 text-xs"><p className="min-w-0 flex-1 truncate text-ink-2">{data.recent?`${data.recent.title} · ${data.recent.amount==null?"sumă neprecizată":formatRon(data.recent.amount)} · ${localDateOf(data.recent.date)===today?"azi":formatShortDate(localDateOf(data.recent.date))}`:"Încă nu ai tranzacții înregistrate"}</p><Link href="/buget/#tranzactii" className="inline-flex min-h-11 items-center font-medium text-brand">Istoric →</Link></div>
    </Card>
    <Sheet open={mealAction!==null} onClose={()=>{if(!busy)setMealAction(null);}} title={mealAction?.kind==="cook"?"Am gătit":"Alege masa de azi"} footer={<Button block disabled={busy||!Number.isInteger(servings)||servings<1||servings>50} onClick={confirmMeal}>{mealAction?.kind==="cook"?"Scade ingredientele":"Programează azi"}</Button>}>
      <p className="mb-4 font-medium">{mealAction?.recipe.name}</p><div className="space-y-4">
        {mealAction?.kind==="plan"&&<LabeledSelect label="Masa" value={slot} onChange={e=>setSlot(e.target.value as MealSlot)}><option value="pranz">Prânz</option><option value="cina">Cină</option></LabeledSelect>}
        <LabeledInput label="Porții" type="number" min={1} max={50} value={Number.isNaN(servings)?"":servings} onChange={e=>setServings(e.target.valueAsNumber)} />
        {mealAction?.kind==="cook"&&<p className="text-sm text-ink-2">Scădem ingredientele disponibile din cămară pentru aceste porții. Confirmă o singură dată pentru fiecare preparare.</p>}
      </div>
    </Sheet>
  </>;
}
