import {expect,it} from "vitest";
import {incomeSummary} from "./income";
it("adună veniturile și scade doar plafonul ales",()=>{
 const sources=[{name:"Soț",amount:3000},{name:"Soție",amount:2000}];
 expect(incomeSummary(sources,4000)).toEqual({total:5000,unallocated:1000});
 expect(incomeSummary(sources,6000)).toEqual({total:5000,unallocated:-1000});
 expect(incomeSummary([{name:"A",amount:0.1},{name:"B",amount:0.2}],0.2)).toEqual({total:0.3,unallocated:0.1});
 expect(incomeSummary(undefined,4000)).toEqual({total:0,unallocated:-4000});
});
