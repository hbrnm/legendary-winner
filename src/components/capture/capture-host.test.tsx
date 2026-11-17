// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CaptureHost } from "./capture-host";
const state=vi.hoisted(()=>({run:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/",useRouter:()=>({push:vi.fn()})}));
vi.mock("@/components/app/app-provider",()=>({useApp:()=>({familyBudgetEnabled:true})}));
vi.mock("@/components/app/hooks",()=>({useAction:()=>({run:state.run,busy:false}),useData:()=>({places:[],lists:[]})}));
vi.mock("@/components/shopping/receipt-capture",()=>({ReceiptCapture:()=> <p>Cititor bon</p>}));
beforeEach(()=>{state.run.mockReset();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
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
