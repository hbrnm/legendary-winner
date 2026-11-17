import {afterAll,beforeAll,expect,it} from "vitest";
import {randomUUID} from "node:crypto";
import {asUser,closeDb,createHousehold,createUser,db,type TestUser} from "./helpers";
let owner:TestUser,other:TestUser,household:string;
beforeAll(async()=>{owner=await createUser("IncomeOwner");other=await createUser("IncomeOther");household=await createHousehold(owner);});
afterAll(closeDb);
const sources=[{name:"Soț",amount:3000},{name:"Soție",amount:2000}];
async function add(income:unknown=sources,period="lunar",kind="familie"){
 const id=randomUUID();
 await asUser(owner,q=>q("insert into budgets(id,household_id,name,period,scope,amount,income_sources) values($1,$2,'Familie',$3,$4,4000,$5)",[id,household,period,{kind},JSON.stringify(income)]));return id;
}
it("păstrează sursele separat de plafon și limitează accesul la gospodărie",async()=>{
 const id=await add();
 expect((await asUser(owner,q=>q("select amount,income_sources from budgets where id=$1",[id]))).rows).toEqual([{amount:"4000.00",income_sources:sources}]);
 expect((await asUser(other,q=>q("select id from budgets where id=$1",[id]))).rows).toEqual([]);
 expect((await asUser(other,q=>q("update budgets set income_sources='[]' where id=$1",[id]))).rowCount).toBe(0);
 await expect(asUser(null,q=>q("select income_sources from budgets where id=$1",[id]))).rejects.toThrow(/permission denied/);
 await asUser(owner,q=>q("update budgets set income_sources='[]' where id=$1",[id]));
 expect((await db().query("select amount,income_sources from budgets where id=$1",[id])).rows).toEqual([{amount:"4000.00",income_sources:[]}]);
});
it("respinge JSON invalid, venituri incompatibile și precizie neacceptată",async()=>{
 for(const invalid of [null,{},[{}],[{name:" ",amount:5}],[{name:"A",amount:0}],[{name:"A",amount:-1}],[{name:"A",amount:1.234}],[{name:"A",amount:"3000"}],[{name:"A",amount:10_000_000}],Array.from({length:31},()=>({name:"A",amount:1}))])await expect(add(invalid)).rejects.toThrow();
 await expect(add(sources,"saptamanal")).rejects.toThrow();
 await expect(add(sources,"lunar","total")).rejects.toThrow();
 await add([],"lunar","total");
});
