import {afterEach,beforeEach,expect,it} from "vitest";
import {CamaraDB,setMeta} from "@/lib/db/database";
import {seedCatalog} from "./bootstrap";
import {createBudget,updateBudget} from "./money";
import {exportHouseholdData,importHouseholdData} from "./backup";
import type {AppCtx} from "./context";
let ctx:AppCtx;
const sources=[{name:"Salariu soț",amount:3000},{name:"Salariu soție",amount:2000}];
beforeEach(async()=>{ctx={db:new CamaraDB(`income-${Math.random()}`),householdId:"h1",userId:"u1",sync:true};await seedCatalog(ctx.db);await setMeta(ctx.db,"server_missing:manual_expenses",false);});
afterEach(async()=>{await ctx.db.delete();});
it("salvează sursele separat de plafon și le păstrează la modificarea plafonului",async()=>{
 const id=await createBudget(ctx,{name:"Bugetul lunii",scope:{kind:"familie"},period:"lunar",amount:4000,income_sources:sources});
 expect(await ctx.db.budgets.get(id)).toMatchObject({amount:4000,income_sources:sources});
 await updateBudget(ctx,id,{amount:4500});
 expect(await ctx.db.budgets.get(id)).toMatchObject({amount:4500,income_sources:sources});
 await updateBudget(ctx,id,{income_sources:[{name:"Alt venit",amount:500}]});
 expect(await ctx.db.budgets.get(id)).toMatchObject({amount:4500,income_sources:[{name:"Alt venit",amount:500}]});
 await updateBudget(ctx,id,{income_sources:[]});
 expect((await ctx.db.budgets.get(id))?.income_sources).toEqual([]);
});
it("respinge sursele invalide și bugetele incompatibile fără a pierde datele",async()=>{
 const base={name:"Buget",scope:{kind:"familie" as const},period:"lunar" as const,amount:4000};
 for(const source of [{name:" ",amount:3000},{name:"Salariu",amount:0},{name:"Salariu",amount:1.234},{name:"Salariu",amount:10_000_000}]){
  await expect(createBudget(ctx,{...base,income_sources:[source]})).rejects.toThrow();
 }
 await expect(createBudget(ctx,{...base,period:"saptamanal",income_sources:sources})).rejects.toThrow();
 const id=await createBudget(ctx,{...base,income_sources:sources});
 await expect(updateBudget(ctx,id,{scope:{kind:"cheltuiala",category_id:"educatie"}})).rejects.toThrow();
 await expect(updateBudget({...ctx,householdId:"other"},id,{income_sources:[]})).rejects.toThrow();
 expect((await ctx.db.budgets.get(id))?.income_sources).toEqual(sources);
});
it("păstrează veniturile în copia de siguranță",async()=>{
 await createBudget(ctx,{name:"Buget",scope:{kind:"familie"},period:"lunar",amount:4000,income_sources:sources});
 const backup=await exportHouseholdData(ctx);
 const second=new CamaraDB(`income-backup-${Math.random()}`);
 try{await seedCatalog(second);await importHouseholdData({...ctx,db:second,sync:false},backup);expect((await second.budgets.toArray())[0]).toMatchObject({amount:4000,income_sources:sources});}finally{await second.delete();}
});
