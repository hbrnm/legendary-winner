// @vitest-environment jsdom
import { StrictMode } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ReceiptCapture } from './receipt-capture';
const mocks=vi.hoisted(()=>({read:vi.fn(async()=> 'KAUFLAND\nPAINE 5,00 C\nTOTAL 5,00'),load:vi.fn(async()=>({width:600,height:1800,close:vi.fn()}))}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:vi.fn()})}));
vi.mock('@/components/app/app-provider',()=>({useApp:()=>({mode:'demo'})}));
vi.mock('@/components/app/hooks',()=>({useData:()=>({retailers:[],categories:[],lists:[],products:new Map()}),useAction:()=>({busy:false,run:async(fn:()=>Promise<unknown>)=>fn()})}));
vi.mock('@/lib/services/receipts',()=>({applyReceipt:vi.fn(),proposeReceiptMatches:async()=>[],proposeReceiptCategories:async()=>[]}));
vi.mock('@/lib/ocr/read-receipt',async()=>({...(await vi.importActual('@/lib/ocr/read-receipt')),loadImage:mocks.load,proposeCrop:()=>({x:0,y:0,width:1,height:1}),readReceipt:mocks.read}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('reads an initial file once under StrictMode and permits manual reframing afterwards',async()=>{
 URL.createObjectURL=()=> 'blob:receipt';URL.revokeObjectURL=vi.fn();
 render(<StrictMode><ReceiptCapture initialFile={new File(['photo'],'receipt.jpg',{type:'image/jpeg'})} autoRead /></StrictMode>);
 await screen.findByRole('heading',{name:'Verifică bonul'});
 expect(mocks.read).toHaveBeenCalledOnce();
 expect(screen.queryByRole('button',{name:'Citește bonul'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Reîncadrează bonul'}));
 await screen.findByRole('button',{name:'Citește bonul'});
 expect(mocks.read).toHaveBeenCalledOnce();
});
