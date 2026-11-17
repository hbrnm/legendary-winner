import { afterEach, beforeEach, expect, it } from "vitest";
import { CamaraDB, setMeta } from "@/lib/db/database";
import { seedCatalog } from "./bootstrap";
import { addItem, createList, finalizeShopping, setActualPrice, setChecked } from "./shopping";
import { householdSpendRecords } from "./queries";
import { createExpense, updateExpense } from "./expenses";
import * as budget from "@/lib/domain/budget";
import { setClock } from "@/lib/clock";
import type { AppCtx } from "./context";
let ctx: AppCtx;
beforeEach(async () => { setClock("2026-11-16T10:00:00Z"); ctx = { db: new CamaraDB(`capture-${Math.random()}`), householdId:"h1", userId:"u1", sync:true }; await seedCatalog(ctx.db); await setMeta(ctx.db,"server_missing:manual_expenses",false); });
afterEach(async () => { await ctx.db.delete(); setClock(null); });
it.each([30, 5])("uses declared total %s once and preserves unknown/known prices", async total => {
 const list = await createList(ctx,{name:"Trip"});
 const a = await addItem(ctx,list,{product_id:"rosii",quantity:1,unit:"kg"}); const b = await addItem(ctx,list,{name:"Other"});
 await setActualPrice(ctx,a,10); await setChecked(ctx,b,true);
 const result = await finalizeShopping(ctx,list,{addToPantry:false,totalPaid:total,retailerId:"lidl"});
 expect(result.total).toBe(total);
 const records = await householdSpendRecords(ctx.db,"h1");
 expect(budget.sumAmounts(records)).toBe(total);
 expect(records.find(i=>i.category_id === "nealocat")?.amount).toBe(total-10);
 const categories=new Map((await ctx.db.product_categories.toArray()).map(c=>[c.id,c]));
 expect(budget.expenseCategoryOf(records.find(i=>i.unallocated)!,categories)).toBeNull();
 expect(budget.byExpenseCategory(records,categories).find(c=>c.key === "nealocat")).toMatchObject({label:"Nealocat",amount:total-10});
 expect((await ctx.db.shopping_transaction_items.toArray()).map(i=>i.amount).sort()).toEqual([10,null]);
 expect(await ctx.db.product_prices.count()).toBe(1);
 await expect(finalizeShopping(ctx,list,{addToPantry:false})).rejects.toThrow();
 expect(await ctx.db.shopping_transactions.count()).toBe(1);
});
it("total-only receipt does not invent item prices",async()=>{
 const list=await createList(ctx,{name:"Trip"});const id=await addItem(ctx,list,{name:"Unknown"});await setChecked(ctx,id,true);
 await finalizeShopping(ctx,list,{addToPantry:false,totalPaid:42});
 expect(budget.sumAmounts(await householdSpendRecords(ctx.db,"h1"))).toBe(42);expect(await ctx.db.product_prices.count()).toBe(0);
});
it("keeps unchecked lines active and never purchases checked lines again",async()=>{
 const list=await createList(ctx,{name:"Partial"});const bought=await addItem(ctx,list,{product_id:"rosii",quantity:1,unit:"kg"});const left=await addItem(ctx,list,{name:"Later"});await setActualPrice(ctx,bought,10);
 await finalizeShopping(ctx,list,{addToPantry:true});
 expect((await ctx.db.shopping_lists.get(list))?.archived_at).toBeNull();expect((await ctx.db.shopping_list_items.get(bought))?.deleted_at).toBeTruthy();expect((await ctx.db.shopping_list_items.get(left))?.checked).toBe(false);
 await expect(finalizeShopping(ctx,list,{addToPantry:true})).rejects.toThrow();expect(await ctx.db.pantry_items.count()).toBe(1);
});
it("stores validated scoped expense metadata and preserves it on update",async()=>{
 const id=await createExpense(ctx,{description:"Groceries",amount:20,category_id:"alimentatie",spent_on:"2026-11-16",place_name:"Market",retailer_id:"lidl",source:"piata",note:"Saturday"});
 await updateExpense(ctx,id,{amount:21});expect(await ctx.db.manual_expenses.get(id)).toMatchObject({place_name:"Market",retailer_id:"lidl",source:"piata",note:"Saturday"});
 expect((await householdSpendRecords(ctx.db,"h1"))[0]).toMatchObject({retailer_id:"lidl",source:"piata"});
 await expect(createExpense(ctx,{description:"Bad",amount:2,category_id:"altele",spent_on:"2026-11-16",retailer_id:"missing"})).rejects.toThrow();
});
it("calculates daily availability using inclusive days and leap years",()=>{
 expect(budget.dailyBudgetAvailable(150,"2026-11-16")).toBe(10);
 expect(budget.dailyBudgetAvailable(50,"2026-11-30")).toBe(50);
 expect(budget.dailyBudgetAvailable(20,"2028-02-28")).toBe(10);
 expect(budget.dailyBudgetAvailable(-5,"2026-11-30")).toBe(0);
});

it("creates owned food products only for known stock quantities and reports pending stock",async()=>{
 const list=await createList(ctx,{name:"Food"});
 const known=await addItem(ctx,list,{name:"Home bread",quantity:2,unit:"buc",category_id:"panificatie"});
 const unknown=await addItem(ctx,list,{product_id:"rosii"});
 const nonfood=await addItem(ctx,list,{name:"Soap",quantity:1,unit:"buc",category_id:"igiena"});
 for(const id of [known,unknown,nonfood]) await setChecked(ctx,id,true);
 const result=await finalizeShopping(ctx,list,{addToPantry:true});
 expect(result).toMatchObject({added_to_pantry:1,pending_pantry:1});
 const stock=await ctx.db.pantry_items.toArray();expect(stock).toHaveLength(1);expect(stock[0]).toMatchObject({name:"Home bread",quantity:2,unit:"buc"});
 expect(await ctx.db.products.get(stock[0].product_id!)).toMatchObject({household_id:"h1",name:"Home bread"});
});
it("resets recurring checked lines and guards concurrent finalization",async()=>{
 const list=await createList(ctx,{name:"Weekly",is_recurring:true}); const id=await addItem(ctx,list,{product_id:"rosii",quantity:1,unit:"kg"});await setActualPrice(ctx,id,10);
 const results=await Promise.allSettled([finalizeShopping(ctx,list,{addToPantry:true}),finalizeShopping(ctx,list,{addToPantry:true})]);
 expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);
 expect(await ctx.db.shopping_transactions.count()).toBe(1);expect(await ctx.db.pantry_items.count()).toBe(1);
 expect(await ctx.db.shopping_list_items.get(id)).toMatchObject({checked:false,actual_price:null,deleted_at:null});
 await setActualPrice(ctx,id,12);await finalizeShopping(ctx,list,{addToPantry:true});
 expect(budget.sumAmounts(await householdSpendRecords(ctx.db,"h1"))).toBe(22);
});
it("roundtrips authoritative totals and metadata in old-compatible backups",async()=>{
 const {exportHouseholdData,importHouseholdData}=await import("./backup");
 const {normalizeRemote}=await import("@/lib/db/write");
 expect(normalizeRemote("shopping_transactions",{declared_total:"12.50"}).declared_total).toBe(12.5);
 const list=await createList(ctx,{name:"Trip"});const item=await addItem(ctx,list,{name:"Unknown"});await setChecked(ctx,item,true);
 await finalizeShopping(ctx,list,{addToPantry:false,totalPaid:12.5,retailerId:"lidl"});
 await createExpense(ctx,{description:"Market",amount:2,category_id:"alimentatie",spent_on:"2026-11-16",place_name:"Stall",source:"piata",note:"Fruit",retailer_id:"lidl"});
 const other=new CamaraDB(`capture-backup-${Math.random()}`);
 try {
  await seedCatalog(other); await importHouseholdData({...ctx,db:other},await exportHouseholdData(ctx));
  expect(budget.sumAmounts(await householdSpendRecords(other,"h1"))).toBe(14.5);
  expect((await other.manual_expenses.toArray())[0]).toMatchObject({place_name:"Stall",source:"piata",note:"Fruit",retailer_id:"lidl"});
 } finally {await other.delete();}
});
it("keeps finalized item amounts and declared adjustment in the same purchase month",async()=>{
 setClock("2026-10-31T10:00:00Z");const list=await createList(ctx,{name:"Month end"});const id=await addItem(ctx,list,{product_id:"rosii"});await setActualPrice(ctx,id,100);
 setClock("2026-11-01T10:00:00Z");await finalizeShopping(ctx,list,{addToPantry:false,totalPaid:80});
 const records=await householdSpendRecords(ctx.db,"h1");
 expect(budget.monthlyTotals(records,"2026-11-01",2).map(m=>m.amount)).toEqual([0,80]);
 expect((await ctx.db.shopping_transaction_items.toArray())[0].purchased_at).toContain("2026-10-31");
});

it('refuses quick-add into another household list without writing rows or outbox',async()=>{
 const foreign={...ctx,householdId:'h2',userId:'u2'};
 const list=await createList(foreign,{name:'Other household'});
 const before=await ctx.db.outbox.count();
 await expect(addItem(ctx,list,{name:'Must not be added'})).rejects.toThrow();
 expect(await ctx.db.shopping_list_items.count()).toBe(0);
 expect(await ctx.db.outbox.count()).toBe(before);
});
it('refuses quick-add into a list archived after the picker opened',async()=>{
 const list=await createList(ctx,{name:'Archived'});
 await ctx.db.shopping_lists.update(list,{archived_at:'2026-11-16T10:00:00Z'});
 await expect(addItem(ctx,list,{name:'Must not be added'})).rejects.toThrow();
 expect(await ctx.db.shopping_list_items.count()).toBe(0);
});
