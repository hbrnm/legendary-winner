// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ActiveShoppingListProvider,useActiveShoppingList } from './active-list-provider';
const state=vi.hoisted(()=>({household:'one',dataHousehold:'one',lists:[{id:'a',pending:2,updated_at:'2026-11-17',archived_at:null,deleted_at:null},{id:'b',pending:1,updated_at:'2026-11-17',archived_at:null,deleted_at:null}]}));
vi.mock('@/components/app/app-provider',()=>({useApp:()=>({ctx:{householdId:state.household},userId:'u',mode:'demo'})}));
vi.mock('@/components/app/hooks',()=>({useData:()=>({householdId:state.dataHousehold,lists:state.lists})}));
function View(){const a=useActiveShoppingList();return <><p>{a.activeListId??'none'}</p><button onClick={()=>a.selectList('b')}>Select</button></>;}
afterEach(()=>{cleanup();vi.restoreAllMocks();localStorage.clear();state.household='one';state.dataHousehold='one';});
it('does not expose stale selections when household changes',()=>{
 const view=render(<ActiveShoppingListProvider><View/></ActiveShoppingListProvider>);
 fireEvent.click(view.getByRole('button'));expect(view.getByText('b')).toBeTruthy();
 state.household='two';view.rerender(<ActiveShoppingListProvider><View/></ActiveShoppingListProvider>);
 expect(view.getByText('none')).toBeTruthy();
 state.dataHousehold='two';view.rerender(<ActiveShoppingListProvider><View/></ActiveShoppingListProvider>);
 expect(view.getByText('a')).toBeTruthy();
});
it('keeps selection working when browser storage is unavailable',()=>{
 vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw new Error('blocked');});
 vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new Error('blocked');});
 const view=render(<ActiveShoppingListProvider><View/></ActiveShoppingListProvider>);
 fireEvent.click(view.getByRole('button'));expect(view.getByText('b')).toBeTruthy();
});
