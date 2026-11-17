import {afterEach,beforeEach,expect,it} from "vitest";
import {CamaraDB} from "@/lib/db/database";
import {setClock} from "@/lib/clock";
import {seedCatalog} from "./bootstrap";
import {applyReceipt} from "./receipts";
import {addItem,createList} from "./shopping";
import {listItems} from "./queries";
import type {AppCtx} from "./context";
let ctx:AppCtx;
const line={product_id:"lapte-integral",name:"Lapte integral",receipt_text:"Lapte",quantity:1,unit:"l" as const,amount:8};
beforeEach(async()=>{setClock("2026-11-16T10:00:00Z");ctx={db:new CamaraDB(`receipt-integrity-${Math.random()}`),householdId:"h1",userId:"u1",sync:true};await seedCatalog(ctx.db);});
afterEach(async()=>{await ctx.db.delete();setClock(null);});
it("matches exact free-text catalog aliases and preserves unrelated/incompatible lines",async()=>{
 const list=await createList(ctx,{name:"Trip"});const milk=await addItem(ctx,list,{name:" LÁPTE ",quantity:2,unit:"l"});
 const sweets=await addItem(ctx,list,{name:"Bomboane cu lapte"});const incompatible=await addItem(ctx,list,{name:"Lapte",quantity:1,unit:"kg"});
 await applyReceipt(ctx,{retailer_id:"lidl",date:"2026-11-16",list_id:list,lines:[line]});
 const rows=await listItems(ctx.db,list);expect(rows).toHaveLength(3);
 expect(rows.find(r=>r.id===milk)).toMatchObject({product_id:"lapte-integral",checked:true,actual_price:8,quantity:1,unit:"l"});
 expect(rows.find(r=>r.id===sweets)?.checked).toBe(false);expect(rows.find(r=>r.id===incompatible)?.checked).toBe(false);
});
it("rolls back products, prices, stock, aliases and outbox when receipt write fails",async()=>{
 const before=await ctx.db.outbox.toArray();let count=0;
 const fail=()=>{if(++count===2)throw new Error("receipt interrupted");};ctx.db.shopping_transaction_items.hook("creating",fail);
 try {await expect(applyReceipt(ctx,{retailer_id:"lidl",date:"2026-11-16",list_id:null,add_to_pantry:true,lines:[line,{...line,product_id:null,name:"New receipt food",category_id:"lactate"}]})).rejects.toThrow("receipt interrupted");}
 finally {ctx.db.shopping_transaction_items.hook("creating").unsubscribe(fail);}
 for(const table of [ctx.db.shopping_transactions,ctx.db.shopping_transaction_items,ctx.db.product_prices,ctx.db.pantry_items,ctx.db.receipt_aliases])expect(await table.where("household_id").equals("h1").count()).toBe(0);
 expect(await ctx.db.products.where("household_id").equals("h1").count()).toBe(0);expect(await ctx.db.outbox.toArray()).toEqual(before);
});
it("replays a stable submission without spending or stocking twice",async()=>{
 const input={retailer_id:"lidl",date:"2026-11-16",list_id:null,add_to_pantry:true,lines:[line]};
 const first=await applyReceipt(ctx,input,{submissionId:"scan-1"});const second=await applyReceipt(ctx,input,{submissionId:"scan-1"});
 expect(second).toEqual(first);expect(await ctx.db.shopping_transactions.count()).toBe(1);expect(await ctx.db.pantry_items.count()).toBe(1);
});
it("preserves a chosen variant and an incompatible unit when importing a generic product",async()=>{
 const list=await createList(ctx,{name:"Specific milk"});
 const variant=await addItem(ctx,list,{product_id:"lapte-integral",quantity:1,unit:"l"});
 await ctx.db.shopping_list_items.update(variant,{variant_id:"specific-brand"});
 const incompatible=await addItem(ctx,list,{name:"Lapte",quantity:1,unit:"kg"});
 await applyReceipt(ctx,{retailer_id:"lidl",date:"2026-11-16",list_id:list,lines:[line]});
 const rows=await listItems(ctx.db,list);expect(rows).toHaveLength(3);
 expect(rows.find(r=>r.id===variant)).toMatchObject({checked:false,variant_id:"specific-brand",quantity:1,unit:"l"});
 expect(rows.find(r=>r.id===incompatible)?.checked).toBe(false);
 expect(rows.filter(r=>r.checked)).toHaveLength(1);
});
it.each([{quantity:null,unit:null},{quantity:1,unit:null},{quantity:null,unit:"l" as const}])("keeps paid amount but no unit price for unknown receipt quantity/unit %j",async unknown=>{
 const result=await applyReceipt(ctx,{retailer_id:"lidl",date:"2026-11-16",list_id:null,add_to_pantry:true,lines:[{...line,...unknown}]});
 expect(result).toMatchObject({pending_pantry:1,added_to_pantry:0});
 expect((await ctx.db.shopping_transaction_items.toArray())[0]).toMatchObject({...unknown,amount:8});
 expect(await ctx.db.product_prices.count()).toBe(0);expect(await ctx.db.pantry_items.count()).toBe(0);
});
it("never fabricates unit price through list completion or later amount correction",async()=>{
 const {finalizeShopping,setActualPrice,setTransactionItemAmount}=await import("./shopping");
 const list=await createList(ctx,{name:"Unknown quantity"});const id=await addItem(ctx,list,{product_id:"lapte-integral"});await setActualPrice(ctx,id,8);
 const result=await finalizeShopping(ctx,list,{addToPantry:true});expect(result.pending_pantry).toBe(1);
 const [item]=await ctx.db.shopping_transaction_items.toArray();expect(item).toMatchObject({amount:8,quantity:null,unit:null});expect(await ctx.db.product_prices.count()).toBe(0);
 await setTransactionItemAmount(ctx,item.id,9);expect((await ctx.db.shopping_transaction_items.get(item.id))?.amount).toBe(9);expect(await ctx.db.product_prices.count()).toBe(0);
});
