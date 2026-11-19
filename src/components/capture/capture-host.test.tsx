// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CaptureHost } from "./capture-host";
const state=vi.hoisted(()=>({run:vi.fn(),path:"/",push:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>state.path,useRouter:()=>({push:state.push})}));
vi.mock("@/components/app/app-provider",()=>({useApp:()=>({familyBudgetEnabled:true})}));
vi.mock("@/components/app/hooks",()=>({useAction:()=>({run:state.run,busy:false}),useData:()=>({places:[],lists:[],locations:[],index:[],products:new Map(),frequent:[]})}));
vi.mock("@/components/shopping/receipt-capture",()=>({ReceiptCapture:({initialFile}:{initialFile?:File})=> <p>Cititor bon {initialFile?.name}</p>}));
beforeEach(()=>{state.run.mockReset();state.path="/";state.push.mockReset();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(cleanup);
it("returns list receipt capture to checkout instead of opening a separate manual expense",async()=>{
  const checkout=vi.fn();window.addEventListener("camara:checkout",checkout);
  render(<CaptureHost/>);
  await act(async()=>window.dispatchEvent(new CustomEvent("camara:capture",{detail:{mode:"scan",listId:"weekly"}})));
  fireEvent.click(screen.getByRole("button",{name:"Introducere manuală"}));
  expect(checkout).toHaveBeenCalledOnce();
  expect(checkout.mock.calls[0][0].detail).toEqual({listId:"weekly"});
  expect(screen.queryByLabelText("Sumă (RON)")).toBeNull();
  expect(state.run).not.toHaveBeenCalled();
  window.removeEventListener("camara:checkout",checkout);
});

it('offers only recipe creation and import on the recipe tab',()=>{
 state.path='/retete/';render(<CaptureHost/>);
 fireEvent.click(screen.getByRole('button',{name:'Acțiuni rețete'}));
 expect(screen.getByRole('dialog',{name:'Rețete'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Importă rețetă'}));
 expect(state.push).toHaveBeenCalledWith('/retete/import/');
 expect(screen.queryByRole('button',{name:'Adaugă cheltuială'})).toBeNull();
});

it('offers Listă nouă, Copiază o listă mai veche and Importă listă on the shopping tab', async () => {
 state.path='/cumparaturi/';render(<CaptureHost/>);
 fireEvent.click(screen.getByRole('button',{name:'Acțiuni cumpărături'}));
 expect(screen.getByRole('dialog',{name:'Cumpărături'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Listă nouă'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Copiază o listă mai veche'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Importă listă'})).toBeTruthy();
 expect(screen.queryByRole('button',{name:'Adaugă cheltuială'})).toBeNull();

 fireEvent.click(screen.getByRole('button',{name:'Copiază o listă mai veche'}));
 expect(screen.getByRole('dialog',{name:'Copiază o listă mai veche'})).toBeTruthy();
});
it('opens pantry form directly without the universal menu',()=>{
 state.path='/camara/';render(<CaptureHost/>);
 fireEvent.click(screen.getByRole('button',{name:'Adaugă în cămară'}));
 expect(screen.getByRole('dialog',{name:'Adaugă în cămară'})).toBeTruthy();
 expect(screen.getByLabelText('Cantitate')).toBeTruthy();
 expect(screen.queryByRole('dialog',{name:'Adaugă rapid'})).toBeNull();
});
it('opens the already mounted camera input synchronously and waits for a file before mounting OCR',()=>{
 const click=vi.spyOn(HTMLInputElement.prototype,'click');
 const view=render(<CaptureHost/>);
 const input=view.container.querySelector('input[capture="environment"]');expect(input).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Adaugă rapid'}));
 fireEvent.click(screen.getByRole('button',{name:'Scanează bon'}));
 expect(click).toHaveBeenCalledOnce();
 expect(screen.queryByText('Cititor bon')).toBeNull();
 click.mockRestore();
});

it('does not carry a camera file into another capture request',async()=>{
 const view=render(<CaptureHost/>);
 fireEvent.change(view.getByTestId('camera-rapida'),{target:{files:[new File(['x'],'first.jpg',{type:'image/jpeg'})]}});
 await screen.findByText('Cititor bon first.jpg');
 await act(async()=>{window.dispatchEvent(new CustomEvent('camara:capture',{detail:{mode:'scan',listId:'another'}}));});
 expect(screen.queryByText('Cititor bon first.jpg')).toBeNull();
 expect(screen.getByText('Cititor bon')).toBeTruthy();
});

it('resets a cancelled manual draft before accepting a new camera photo',async()=>{
 const view=render(<CaptureHost/>);
 await act(async()=>{window.dispatchEvent(new CustomEvent('camara:capture',{detail:{mode:'manual'}}));});
 fireEvent.change(screen.getByLabelText('Sumă (RON)'),{target:{value:'123'}});
 fireEvent.click(screen.getByRole('button',{name:'Închide'}));
 fireEvent.change(view.getByTestId('camera-rapida'),{target:{files:[new File(['x'],'new.jpg',{type:'image/jpeg'})]}});
 await screen.findByText('Cititor bon new.jpg');
 fireEvent.click(screen.getByRole('button',{name:'Introducere manuală'}));
 expect((screen.getByLabelText('Sumă (RON)') as HTMLInputElement).value).toBe('');
});

it('closes a successfully saved manual expense while the submit guard is still active',async()=>{
 state.run.mockResolvedValue(true);render(<CaptureHost/>);
 await act(async()=>{window.dispatchEvent(new CustomEvent('camara:capture',{detail:{mode:'manual'}}));});
 fireEvent.change(screen.getByLabelText('Sumă (RON)'),{target:{value:'10'}});
 await act(async()=>{fireEvent.click(screen.getByRole('button',{name:'Salvează',hidden:true}));});
 expect(screen.queryByRole('dialog',{name:'Cheltuială'})).toBeNull();
});
