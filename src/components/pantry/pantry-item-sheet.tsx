"use client";
import { useRef, useState } from 'react';
import { useAction, useData } from '@/components/app/hooks';
import { ProductSearch } from '@/components/shopping/product-search';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { LabeledInput, LabeledSelect } from '@/components/ui/fields';
import { addPantryItem } from '@/lib/services/kitchen';
import { visible } from '@/lib/services/queries';
import { SHOPPING_UNITS, unitLabel } from '@/lib/domain/units';
import { toISODate } from '@/lib/domain/dates';
import { now } from '@/lib/clock';
import type { UnitCode } from '@/lib/domain/types';

/** New stock entry; existing stock editing stays in PantryScreen with its metadata intact. */
export function PantryItemSheet({onClose}:{onClose:()=>void}) {
  const {run,busy}=useAction();
  const data=useData(async ctx=>({locations:(await visible(ctx.db,'pantry_locations',ctx.householdId)).sort((a,b)=>a.sort_order-b.sort_order)}));
  const [productId,setProductId]=useState<string|null>(null);
  const [name,setName]=useState('');
  const [quantity,setQuantity]=useState('1');
  const [unit,setUnit]=useState<UnitCode>('buc');
  const [location,setLocation]=useState('camara');
  const [expires,setExpires]=useState('');
  const [purchased,setPurchased]=useState(toISODate(now()));
  const [note,setNote]=useState('');
  const saving=useRef(false);
  async function save() {
    if(saving.current)return;
    saving.current=true;
    try {
      const ok=await run(async ctx=>{
        await addPantryItem(ctx,{product_id:productId,name,quantity:Number(quantity.replace(',','.')),unit,location_id:location,expires_on:expires||null,purchased_on:purchased||null,note:note.trim()||null});
        return true;
      });
      if(ok)onClose();
    }finally{saving.current=false;}
  }
  return <Sheet open onClose={()=>{if(!saving.current)onClose();}} title="Adaugă în cămară" footer={<Button block disabled={busy||!name.trim()} onClick={()=>void save()}>Salvează</Button>}>
    <div className="space-y-4">
      <ProductSearch autoFocus inline intent="search" placeholder="Nume produs: ex. 2 kg cartofi" onPick={({product,parsed})=>{
        setProductId(product?.id??null);setName(product?.name??parsed.text);
        setQuantity(String(parsed.quantity??1).replace('.',','));setUnit(parsed.unit??product?.default_unit??'buc');
        const category=product?.category_id;
        setLocation(category==='congelate'?'congelator':category&&['lactate','branzeturi','carne','peste','mezeluri','oua'].includes(category)?'frigider':'camara');
      }}/>
      {name&&<LabeledInput label="Numele produsului" value={name} onChange={e=>{setName(e.target.value);setProductId(null);}} maxLength={120}/>}
      <div className="grid grid-cols-2 gap-3">
        <LabeledInput label="Cantitate" inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)}/>
        <LabeledSelect label="Unitate" value={unit} onChange={e=>setUnit(e.target.value as UnitCode)}>{SHOPPING_UNITS.map(u=><option key={u} value={u}>{unitLabel(u,2)}</option>)}</LabeledSelect>
      </div>
      <LabeledSelect label="Unde îl ții" value={location} onChange={e=>setLocation(e.target.value)}>{data?.locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</LabeledSelect>
      <details className="rounded-xl border border-line p-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Detalii opționale (expirare, observații)</summary>
        <div className="mt-3 space-y-4"><LabeledInput label="Expiră pe" type="date" value={expires} onChange={e=>setExpires(e.target.value)}/><LabeledInput label="Cumpărat pe" type="date" value={purchased} onChange={e=>setPurchased(e.target.value)}/><LabeledInput label="Observații" value={note} maxLength={300} onChange={e=>setNote(e.target.value)}/></div>
      </details>
    </div>
  </Sheet>;
}
