"use client";

import {useId,useRef,useState} from "react";
import {Pencil,Plus,Trash2} from "lucide-react";
import {useAction} from "@/components/app/hooks";
import {Button,IconButton} from "@/components/ui/button";
import {Card} from "@/components/ui/misc";
import {LabeledInput} from "@/components/ui/fields";
import {Sheet} from "@/components/ui/sheet";
import {createBudget,incomeSourcesSchema,updateBudget} from "@/lib/services/money";
import {incomeSummary} from "@/lib/domain/income";
import {formatRon,parseMoney} from "@/lib/domain/money";
import type {Budget} from "@/lib/domain/types";

type DraftSource={key:number;name:string;amount:string};
export function IncomePanel({budget}:{budget:Budget|undefined}){
 const {run,busy}=useAction();
 const formId=useId();
 const [open,setOpen]=useState(false);
 const [sources,setSources]=useState<DraftSource[]>([]);
 const [allocation,setAllocation]=useState("");
 const [error,setError]=useState<string|null>(null);
 const serial=useRef(0),submitting=useRef(false);
 const summary=incomeSummary(budget?.income_sources,budget?.amount??0);
 const draft=incomeSummary(sources.map(source=>({name:source.name,amount:parseMoney(source.amount)??0})),parseMoney(allocation)??0);
 function openForm(add:boolean){
  const existing=(budget?.income_sources??[]).map(source=>({key:serial.current++,name:source.name,amount:source.amount.toFixed(2).replace(".",",")}));
  setSources(add||existing.length===0?[...existing,{key:serial.current++,name:"",amount:""}]:existing);
  setAllocation(budget?budget.amount.toFixed(2).replace(".",","):"");setError(null);setOpen(true);
 }
 function update(key:number,patch:Partial<DraftSource>){setSources(previous=>previous.map(source=>source.key===key?{...source,...patch}:source));setError(null);}
 async function save(){
  if(submitting.current)return;
  const parsed=incomeSourcesSchema.safeParse(sources.map(source=>({name:source.name,amount:parseMoney(source.amount)})));
  if(!parsed.success){setError(parsed.error.issues[0]?.message??"Verifică numele și suma fiecărui venit.");return;}
  const amount=parseMoney(allocation);
  if(amount==null||amount<=0||amount>9_999_999){setError("Scrie bugetul pentru cheltuieli, între 0,01 și 9.999.999 lei.");return;}
  submitting.current=true;
  try{
   const ok=await run(async ctx=>{
    const input={income_sources:parsed.data,amount,scope:{kind:"familie" as const},period:"lunar" as const};
    if(budget)await updateBudget(ctx,budget.id,input);
    else await createBudget(ctx,{...input,name:"Bugetul lunii"});
    return true;
   },"Am salvat veniturile și bugetul pentru cheltuieli.");
   if(ok)setOpen(false);
  }finally{submitting.current=false;}
 }
 return <>
  <section aria-label="Venituri lunare" className="mb-4">
   <Card className="p-4">
    <div className="flex items-center justify-between gap-2"><h2 className="font-semibold">Venituri lunare</h2><div className="flex items-center gap-1">
     {budget&&<IconButton label="Modifică veniturile și alocarea" onClick={()=>openForm(false)}><Pencil size={18}/></IconButton>}
     <Button size="sm" variant="secondary" icon={<Plus size={16}/>} aria-label="Adaugă venit" onClick={()=>openForm(true)}>Venit</Button>
    </div></div>
    {budget?.income_sources?.length?<>
     <p className="mt-2 text-2xl font-semibold tabular-nums">{formatRon(summary.total)} <span className="text-sm font-normal text-ink-2">total venituri</span></p>
     <ul className="mt-2 space-y-1">{budget.income_sources.map((source,index)=><li key={index} className="flex justify-between gap-3 text-sm"><span className="min-w-0 break-words">{source.name}</span><span className="shrink-0 tabular-nums">{formatRon(source.amount)}</span></li>)}</ul>
     <div className="mt-3 border-t border-line pt-3 text-sm"><p>Alocat cheltuielilor: <strong className="tabular-nums">{formatRon(budget.amount)}</strong></p><p className={`mt-1 tabular-nums ${summary.unallocated<0?"text-accent":"text-info"}`}>{formatRon(Math.abs(summary.unallocated))} {summary.unallocated<0?"peste venituri":"nealocați"}</p></div>
    </>:<p className="mt-2 text-sm text-ink-2">Adaugă salarii sau alte venituri și alege separat cât aloci cheltuielilor.</p>}
   </Card>
  </section>
  <Sheet open={open} onClose={()=>{if(!busy)setOpen(false);}} title="Venituri și alocare" footer={<Button block type="submit" form={formId} disabled={busy} aria-busy={busy}>{busy?"Se salvează…":"Salvează veniturile"}</Button>}>
   <form id={formId} onSubmit={event=>{event.preventDefault();void save();}} className="space-y-4">
    <p className="text-sm text-ink-2">Sume lunare recurente. Totalul veniturilor și plafonul de cheltuieli se aleg separat.</p>
    {sources.map((source,index)=><fieldset key={source.key} className="space-y-3 rounded-2xl border border-line p-3"><legend className="text-sm font-medium">Venit {index+1}</legend><div className="flex justify-end"><IconButton label={`Elimină venitul ${index+1}`} onClick={()=>setSources(previous=>previous.filter(item=>item.key!==source.key))}><Trash2 size={17}/></IconButton></div><LabeledInput label={`Numele venitului ${index+1}`} maxLength={60} placeholder="ex. Salariu soț" value={source.name} onChange={event=>update(source.key,{name:event.target.value})}/><LabeledInput label={`Venitul ${index+1} (RON)`} inputMode="decimal" placeholder="ex. 3000" value={source.amount} onChange={event=>update(source.key,{amount:event.target.value})}/></fieldset>)}
    <Button block variant="secondary" icon={<Plus size={17}/>} disabled={sources.length>=30} onClick={()=>setSources(previous=>[...previous,{key:serial.current++,name:"",amount:""}])}>Adaugă o sursă</Button>
    <p className="font-semibold tabular-nums">Total venituri: {formatRon(draft.total)}</p>
    <LabeledInput label="Buget pentru cheltuieli (RON)" inputMode="decimal" placeholder="ex. 4000" value={allocation} onChange={event=>{setAllocation(event.target.value);setError(null);}}/>
    <p className={`text-sm tabular-nums ${draft.unallocated<0?"text-accent":"text-info"}`}>{formatRon(Math.abs(draft.unallocated))} {draft.unallocated<0?"peste venituri — poți salva dacă acoperi diferența din alte fonduri.":"nealocați din venituri"}</p>
    {error&&<p role="alert" className="text-sm text-accent">{error}</p>}
   </form>
  </Sheet>
 </>;
}
