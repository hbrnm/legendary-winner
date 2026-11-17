import { afterAll, beforeAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { asUser, closeDb, createHousehold, createUser, type TestUser } from "./helpers";
let user: TestUser, other: TestUser, household: string, foreignPlace: string;
beforeAll(async()=>{
 user=await createUser("CaptureOwner");other=await createUser("CaptureOther");
 household=await createHousehold(user);const foreignHousehold=await createHousehold(other);foreignPlace=randomUUID();
 await asUser(other,q=>q("insert into retailers(id,household_id,name,kind) values($1,$2,'Private market','piata')",[foreignPlace,foreignHousehold]));
});
afterAll(closeDb);
it("accepts old rows, validates totals, and scopes receipt places",async()=>{
 const insert=(total:number|null,place:string|null=null)=>asUser(user,q=>q("insert into shopping_transactions(id,household_id,started_at,declared_total,retailer_id) values($1,$2,now(),$3,$4)",[randomUUID(),household,total,place]));
 await insert(null);await insert(0);await insert(42.5);
 await expect(insert(-1)).rejects.toThrow();await expect(insert(10,foreignPlace)).rejects.toThrow();
});
it("keeps metadata optional and validates expense sources and household places",async()=>{
 const insert=(source:string|null,place:string|null=null)=>asUser(user,q=>q("insert into manual_expenses(id,household_id,description,amount,category_id,spent_on,place_name,retailer_id,source,note) values($1,$2,'Market',20,'alimentatie','2026-11-16','Stall',$3,$4,'Fruit') returning source,note",[randomUUID(),household,place,source]));
 await insert(null);expect((await insert("piata")).rows[0]).toMatchObject({source:"piata",note:"Fruit"});
 await expect(insert("invalid")).rejects.toThrow();await expect(insert("piata",foreignPlace)).rejects.toThrow();
});
