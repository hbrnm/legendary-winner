"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useApp } from '@/components/app/app-provider';
import { useData } from '@/components/app/hooks';
import { listItems, owned } from '@/lib/services/queries';
import { selectActiveList } from '@/lib/domain/active-shopping-list';

const ActiveListContext = createContext<{activeListId:string|null;selectList:(id:string)=>void;ready:boolean}>({activeListId:null,selectList:()=>{},ready:false});
function readPreferred(key:string) { try { return typeof window === 'undefined' ? null : window.localStorage.getItem(key); } catch { return null; } }
export function ActiveShoppingListProvider({children}:{children:ReactNode}) {
  const {ctx, mode, userId} = useApp();
  const key = `camara-lista-activa:${mode}:${userId ?? 'local'}:${ctx?.householdId ?? ''}`;
  const [choices,setChoices] = useState<Record<string,string>>({});
  const data = useData(async c => ({householdId:c.householdId, lists:await Promise.all((await owned(c.db,'shopping_lists',c.householdId)).map(async list => ({...list,pending:(await listItems(c.db,list.id)).filter(i=>!i.checked).length})))}));
  const ready = !!ctx && data?.householdId === ctx.householdId;
  const lists = ready ? data!.lists : [];
  const activeListId = selectActiveList(lists, choices[key] ?? readPreferred(key));
  const selectList = useCallback((id:string) => {
    if (!ctx) return; // selectActiveList validates even preferences written before a live query refresh.
    setChoices(previous=>previous[key]===id?previous:{...previous,[key]:id});
    try { window.localStorage.setItem(key,id); } catch { /* In-memory selection still works. */ }
  },[ctx,key]);
  return <ActiveListContext.Provider value={{activeListId,selectList,ready}}>{children}</ActiveListContext.Provider>;
}
export const useActiveShoppingList = () => useContext(ActiveListContext);
