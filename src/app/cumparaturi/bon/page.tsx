"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, ImageIcon, Mic, Search } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { ProductSearch } from "@/components/shopping/product-search";
import { Button } from "@/components/ui/button";
import { Badge, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { Input, LabeledInput, LabeledSelect, TextArea } from "@/components/ui/fields";
import { owned, visible } from "@/lib/services/queries";
import { applyReceipt, proposeReceiptMatches } from "@/lib/services/receipts";
import { parseReceipt, type ParsedReceipt } from "@/lib/domain/receipt";
import { parseTypedPurchases } from "@/lib/domain/typed-purchases";
import { FULL_CROP, type Crop } from "@/lib/domain/receipt-crop";
import { loadImage, proposeCrop, readReceipt, readWithFallback, receiptJpeg, serverReceiptReader, type ReadProgress } from "@/lib/ocr/read-receipt";
import { callReadReceipt } from "@/lib/supabase/client";
import { formatRon, parseMoney, roundMoney, sumMoney } from "@/lib/domain/money";
import { formatQuantity } from "@/lib/domain/units";
import { toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";
import type { Product, UnitCode } from "@/lib/domain/types";

// Bonul fiscal (.tasks/005, etapa 4): fotografia → încadrarea → citirea (cu cont
// și internet pe server, .tasks/015; altfel pe telefon) → „Verifică bonul” →
// aplicarea pe o listă sau ca o cumpărătură. Fără bon, cumpărăturile scrise sau
// dictate trec prin aceeași verificare.

type Step =
  | { kind: "alege" }
  | { kind: "scrie"; text: string }
  | { kind: "incadreaza"; image: ImageBitmap; url: string; crop: Crop }
  | { kind: "citeste"; progress: ReadProgress | null }
  | { kind: "verifica"; receipt: ParsedReceipt; fallback: boolean; /** Textul scris, când produsele nu vin de pe un bon. */ typed: string | null };

interface Line {
  key: number;
  keep: boolean;
  receipt_text: string;
  /** Numele produsului nou din catalog, când linia nu are produs (de la început, cel de pe bon). */
  name: string;
  product: Product | null;
  learned: boolean;
  quantity: number | null;
  unit: UnitCode | null;
  amount: string;
  unsure: boolean;
}

const money = (n: number | null) => (n == null ? "" : n.toFixed(2).replace(".", ","));

/** Dreptunghiul de încadrare peste fotografie, cu colțuri trase cu degetul. */
function CropBox({ url, aspect, crop, onChange }: { url: string; aspect: number; crop: Crop; onChange: (c: Crop) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ corner: "tl" | "br"; start: Crop } | null>(null);

  function move(e: React.PointerEvent) {
    const box = ref.current?.getBoundingClientRect();
    if (!drag.current || !box) return;
    const fx = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    const s = drag.current.start;
    const min = 0.08;
    if (drag.current.corner === "tl") {
      const x = Math.min(fx, s.x + s.width - min);
      const y = Math.min(fy, s.y + s.height - min);
      onChange({ x, y, width: s.x + s.width - x, height: s.y + s.height - y });
    } else {
      onChange({ x: s.x, y: s.y, width: Math.max(min, fx - s.x), height: Math.max(min, fy - s.y) });
    }
  }

  const handle = (corner: "tl" | "br", label: string, style: React.CSSProperties) => (
    <button
      type="button"
      aria-label={label}
      className="absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 touch-none items-center justify-center"
      style={style}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        drag.current = { corner, start: crop };
      }}
      onPointerMove={move}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
    >
      <span className="h-5 w-5 rounded-full border-2 border-brand-ink bg-brand shadow-card" />
    </button>
  );

  return (
    // Toată poza încape pe ecran (cel mult 70% din înălțime), ca ambele colțuri să fie la îndemână.
    // Doar stratul interior taie umbra; colțurile pot ieși puțin peste margine și rămân de atins.
    // Marginea de 24 px ține colțurile (44 px) în pagină, fără derulare orizontală.
    <div className="p-6">
    <div ref={ref} className="relative mx-auto w-full select-none" style={{ maxWidth: `min(28rem, calc(70dvh * ${aspect}))` }}>
      <div className="relative overflow-hidden rounded-lg">
        {/* eslint-disable-next-line @next/next/no-img-element -- fotografia locală, din telefon */}
        <img src={url} alt="Fotografia bonului" className="block w-full" draggable={false} />
        <div
          className="pointer-events-none absolute border-2 border-brand"
          style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.width * 100}%`, height: `${crop.height * 100}%`, boxShadow: "0 0 0 9999px color-mix(in srgb, var(--bg) 70%, transparent)" }}
        />
      </div>
      {handle("tl", "Colțul de sus al bonului", { left: `${crop.x * 100}%`, top: `${crop.y * 100}%` })}
      {handle("br", "Colțul de jos al bonului", { left: `${(crop.x + crop.width) * 100}%`, top: `${(crop.y + crop.height) * 100}%` })}
    </div>
    </div>
  );
}

function ReceiptScreen() {
  const router = useRouter();
  const listParam = useSearchParams().get("lista");
  const { mode } = useApp();
  // Cu cont, bonul decupat se citește pe server (Gemini); fără cont sau fără internet, pe telefon.
  const serverWorks = mode === "cloud";
  const { run, busy } = useAction();
  const [step, setStep] = useState<Step>({ kind: "alege" });
  const [lines, setLines] = useState<Line[]>([]);
  const [retailerId, setRetailerId] = useState("");
  const [date, setDate] = useState(toISODate(now()));
  const [listId, setListId] = useState(listParam ?? "");
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);

  const data = useData(async (ctx) => {
    const [retailers, lists, products] = await Promise.all([visible(ctx.db, "retailers", ctx.householdId), owned(ctx.db, "shopping_lists", ctx.householdId), visible(ctx.db, "products", ctx.householdId)]);
    return {
      retailers: retailers.sort((a, b) => a.name.localeCompare(b.name, "ro")),
      lists: lists.filter((l) => !l.archived_at).sort((a, b) => a.sort_order - b.sort_order),
      products: new Map(products.map((p) => [p.id, p])),
    };
  });

  // Fotografia rămâne doar în memorie și se eliberează când nu mai e nevoie de ea.
  const url = step.kind === "incadreaza" ? step.url : null;
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  const image = step.kind === "incadreaza" ? step.image : null;
  const reading = useRef<ImageBitmap | null>(null);
  useEffect(
    () => () => {
      if (image && image !== reading.current) image.close();
    },
    [image],
  );

  if (!data) return <Spinner />;

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const image = await loadImage(file);
      setStep({ kind: "incadreaza", image, url: URL.createObjectURL(file), crop: proposeCrop(image) });
    } catch {
      setError("Nu am putut deschide fotografia. Încearcă alta.");
    }
  }

  async function read(image: ImageBitmap, crop: Crop) {
    reading.current = image;
    setStep({ kind: "citeste", progress: null });
    let text: string;
    let fallback: boolean;
    const server =
      serverWorks && navigator.onLine
        ? async () => {
            setStep({ kind: "citeste", progress: { progress: 0, stage: "server" } });
            return serverReceiptReader(callReadReceipt)(await receiptJpeg(image, crop));
          }
        : null;
    try {
      ({ text, fallback } = await readWithFallback(server, () => {
        // După server, ecranul trece pe mesajele cititorului de pe telefon.
        setStep({ kind: "citeste", progress: null });
        return readReceipt(image, crop, (progress) => setStep({ kind: "citeste", progress }));
      }));
    } catch {
      image.close();
      setStep({ kind: "alege" });
      setError("Nu am putut citi bonul. Verifică internetul (prima dată se descarcă cititorul) și încearcă din nou.");
      return;
    }
    image.close();
    reading.current = null;
    await review(parseReceipt(text), fallback, null);
  }

  async function review(receipt: ParsedReceipt, fallback: boolean, typed: string | null) {
    const ok = await run(async (ctx) => {
      const retailer = receipt.chain && data!.retailers.some((r) => r.id === receipt.chain) ? receipt.chain : null;
      const proposals = await proposeReceiptMatches(ctx, receipt.lines.map((l) => l.name), retailer);
      setRetailerId(retailer ?? "");
      // O dată din viitor e citită greșit: rămâne ziua de azi, de corectat dacă e nevoie.
      if (receipt.date && receipt.date <= toISODate(now())) setDate(receipt.date);
      setLines(
        receipt.lines.map((l, i) => {
          const p = proposals[i];
          const paid = l.amount == null ? null : roundMoney(l.amount - (l.discount ?? 0));
          return {
            key: i,
            keep: true,
            receipt_text: l.name,
            name: l.name,
            product: p ? (data!.products.get(p.product_id) ?? null) : null,
            learned: p?.source === "invatat",
            quantity: l.quantity,
            unit: l.unit,
            amount: money(paid),
            unsure: l.check === "de_verificat" || p?.source !== "invatat",
          };
        }),
      );
      return true;
    });
    if (ok) setStep({ kind: "verifica", receipt, fallback, typed });
    else setStep(typed != null ? { kind: "scrie", text: typed } : { kind: "alege" });
  }

  function update(key: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function save() {
    setError(null);
    const typed = step.kind === "verifica" && step.typed != null;
    const kept = lines.filter((l) => l.keep);
    const bad = kept.find((l) => parseMoney(l.amount) == null);
    if (kept.length === 0) return setError(typed ? "Păstrează cel puțin un produs." : "Păstrează cel puțin un produs de pe bon.");
    if (bad) return setError(`Scrie suma pentru „${bad.product?.name ?? bad.receipt_text}”, de exemplu 12,50.`);
    const nameless = kept.find((l) => !l.product && !l.name.trim());
    if (nameless) return setError(typed ? "Un produs nu are nume. Alege-l din catalog sau scoate-l." : "Un produs nu are nume. Alege-l din catalog sau scoate-l de pe bon.");
    const r = await run(
      (ctx) =>
        applyReceipt(ctx, {
          retailer_id: retailerId || null,
          date,
          list_id: listId || null,
          lines: kept.map((l) => ({ product_id: l.product?.id ?? null, name: l.product?.name ?? l.name.trim(), receipt_text: l.receipt_text, quantity: l.quantity, unit: l.unit, amount: parseMoney(l.amount)! })),
        }),
      (res) => {
        const done = typed ? "Am pus cumpărăturile." : "Am pus bonul.";
        if (res.created === 0) return done;
        return `${done} Am adăugat ${res.created === 1 ? "un produs nou" : `${res.created} produse noi`} în catalog.`;
      },
    );
    if (r) router.push(listId ? `/cumparaturi/lista/?id=${listId}` : "/cumparaturi/istoric/");
  }

  const header = (
    <div className="mb-4 flex items-center gap-1">
      <Link href="/cumparaturi/" aria-label="Înapoi la cumpărături" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2">
        <ArrowLeft size={20} />
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{step.kind === "verifica" ? (step.typed != null ? "Verifică produsele" : "Verifică bonul") : step.kind === "scrie" ? "Scrie cumpărăturile" : "Adaugă bon"}</h1>
    </div>
  );

  if (step.kind === "alege") {
    return (
      <>
        {header}
        <p className="mb-4 text-[15px] text-ink-2">Fotografiază bonul drept, pe o masă închisă la culoare, cu tot textul în cadru. Bonul se citește pe telefon; fotografia nu se păstrează.</p>
        <div className="flex flex-col gap-2">
          <Button block icon={<Camera size={18} />} onClick={() => camera.current?.click()}>
            Fotografiază bonul
          </Button>
          <Button block variant="secondary" icon={<ImageIcon size={18} />} onClick={() => gallery.current?.click()}>
            Alege din galerie
          </Button>
          <Button block variant="secondary" icon={<Mic size={18} />} onClick={() => setStep({ kind: "scrie", text: "" })}>
            Scrie sau dictează
          </Button>
        </div>
        <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" data-testid="bon-camera" onChange={(e) => void pick(e.target.files?.[0])} />
        <input ref={gallery} type="file" accept="image/*" className="hidden" data-testid="bon-fisier" onChange={(e) => void pick(e.target.files?.[0])} />
        {error && (
          <p role="alert" className="mt-4 text-sm text-accent">
            {error}
          </p>
        )}
      </>
    );
  }

  if (step.kind === "scrie") {
    const go = () => {
      const receipt = parseTypedPurchases(step.text);
      if (receipt.lines.length === 0) return setError("Scrie cel puțin un produs, de exemplu „pâine 5,50”.");
      setError(null);
      void review(receipt, false, step.text);
    };
    return (
      <>
        {header}
        <p className="mb-3 text-[15px] text-ink-2">Scrie ce ai cumpărat, sau apasă microfonul de pe tastatură și spune. Câte un produs pe rând sau despărțite prin virgulă: produsul, cât ai luat (dacă vrei) și suma.</p>
        <TextArea autoFocus rows={8} aria-label="Scrie cumpărăturile" placeholder={"lapte 2 buc 13,98\npâine 5,50\nroșii 1,2 kg 14,30"} value={step.text} onChange={(e) => setStep({ kind: "scrie", text: e.target.value })} />
        {error && (
          <p role="alert" className="mt-4 text-sm text-accent">
            {error}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" onClick={() => (setError(null), setStep({ kind: "alege" }))}>
            Înapoi
          </Button>
          <Button className="flex-1" onClick={go} disabled={busy}>
            Continuă
          </Button>
        </div>
      </>
    );
  }

  if (step.kind === "incadreaza") {
    return (
      <>
        {header}
        <p className="mb-3 text-[15px] text-ink-2">Trage colțurile ca dreptunghiul să cuprindă doar bonul.</p>
        <CropBox url={step.url} aspect={step.image.width / step.image.height} crop={step.crop} onChange={(crop) => setStep({ ...step, crop })} />
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" onClick={() => setStep({ ...step, crop: FULL_CROP })}>
            Toată poza
          </Button>
          <Button className="flex-1" onClick={() => void read(step.image, step.crop)}>
            Citește bonul
          </Button>
        </div>
        {serverWorks && <p className="mt-3 text-sm text-ink-2">Cu internet, bonul decupat se citește pe server și nu se păstrează. Fără internet, îl citesc pe telefon.</p>}
      </>
    );
  }

  if (step.kind === "citeste") {
    const p = step.progress;
    return (
      <>
        {header}
        <div className="flex flex-col items-center gap-3 py-10 text-center" role="status">
          <Spinner />
          {p?.stage === "server" ? (
            <>
              <p className="text-[15px]">Citesc bonul…</p>
              <p className="text-sm text-ink-2">Durează câteva secunde.</p>
            </>
          ) : (
            <>
              <p className="text-[15px]">{p?.stage === "citire" ? `Citesc bonul… ${Math.round(p.progress * 100)}%` : "Pregătesc cititorul…"}</p>
              <p className="text-sm text-ink-2">Prima dată durează mai mult: se descarcă cititorul de bonuri.</p>
            </>
          )}
        </div>
      </>
    );
  }

  const kept = lines.filter((l) => l.keep);
  const sum = sumMoney(kept.map((l) => parseMoney(l.amount) ?? 0));
  const total = step.receipt.total;
  const typed = step.typed != null;
  return (
    <>
      {header}
      {step.fallback && <p role="note" className="mb-3 rounded-md border border-dashed border-accent bg-surface px-3.5 py-2.5 text-sm text-ink">Nu am putut citi bonul pe server, așa că l-am citit pe telefon. Verifică liniile cu atenție.</p>}
      <p className="mb-4 text-[15px] text-ink-2">
        {typed ? "Am găsit" : "Am citit"} {lines.length === 1 ? "un produs" : `${lines.length} produse`}. Verifică fiecare linie: produsul, suma.{typed ? "" : " Cele marcate „de verificat” pot fi citite greșit."}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <LabeledSelect label="Magazinul" value={retailerId} onChange={(e) => setRetailerId(e.target.value)}>
          <option value="">Nu știu</option>
          {data.retailers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </LabeledSelect>
        <LabeledInput label="Data" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <LabeledSelect label="Unde pun produsele" value={listId} onChange={(e) => setListId(e.target.value)} hint={listId ? "Le bifez pe listă, cu prețul de pe bon. Apoi apeși „Gata”, ca de obicei." : "Intră direct în istoric și în buget, cu prețurile plătite."}>
        <option value="">Fără listă (doar cumpărătura)</option>
        {data.lists.map((l) => (
          <option key={l.id} value={l.id}>
            Pe lista „{l.name}”
          </option>
        ))}
      </LabeledSelect>

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {lines.map((l) => (
          <li key={l.key} className={`flex flex-col gap-2 px-4 py-3 ${l.keep ? "" : "opacity-60"}`}>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{l.product?.name ?? (l.name || l.receipt_text || "Produs necitit")}</p>
                <p className="truncate text-xs text-ink-2">
                  {typed ? "ai scris" : "pe bon"}: {l.receipt_text || "—"}
                  {l.quantity != null && l.unit ? ` · ${formatQuantity(l.quantity, l.unit)}` : ""}
                </p>
              </div>
              {l.keep && !l.product ? <Badge tone="info">produs nou</Badge> : l.keep && l.unsure && <Badge tone="warn">de verificat</Badge>}
            </div>
            {l.keep && !l.product && <LabeledInput label="Numele în catalog" value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} />}
            {l.keep && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" icon={<Search size={16} />} onClick={() => setPicking(l.key)}>
                  {l.product ? "Alt produs" : "Alege produsul"}
                </Button>
                <Input inputMode="decimal" value={l.amount} onChange={(e) => update(l.key, { amount: e.target.value, unsure: false })} placeholder="0,00" className="w-24 text-right tabular" aria-label={`Suma pentru ${l.product?.name ?? l.name}`} />
                <span className="text-sm text-ink-2">lei</span>
              </div>
            )}
            <label className="flex min-h-11 items-center gap-2 text-sm text-ink-2">
              <input type="checkbox" className="h-5 w-5" checked={!l.keep} onChange={(e) => update(l.key, { keep: !e.target.checked })} />
              {typed ? "Nu e un produs (scris greșit)" : "Nu e un produs (reducere, garanție, citit greșit)"}
            </label>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-lg bg-surface-2 px-4 py-3 text-[15px]">
        <p className="flex justify-between">
          <span>Suma produselor</span>
          <span className="font-medium tabular">{formatRon(sum)}</span>
        </p>
        {total != null && (
          <p className="flex justify-between text-ink-2">
            <span>Totalul de pe bon</span>
            <span className="tabular">{formatRon(total)}</span>
          </p>
        )}
        {total != null && Math.abs(total - sum) >= 0.005 && <p className="mt-1 text-sm text-warn">Sumele nu se potrivesc cu totalul bonului. Verifică liniile marcate.</p>}
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-accent">
          {error}
        </p>
      )}
      <div className="mt-4 flex gap-2">
        <Button variant="ghost" onClick={() => setStep(step.typed != null ? { kind: "scrie", text: step.typed } : { kind: "alege" })}>
          {typed ? "Înapoi" : "Alt bon"}
        </Button>
        <Button className="flex-1" onClick={save} disabled={busy}>
          {typed ? "Salvează" : "Salvează bonul"}
        </Button>
      </div>

      <Sheet open={picking !== null} onClose={() => setPicking(null)} title="Alege produsul">
        <ProductSearch
          autoFocus
          placeholder="Caută produsul (ex. lapte)"
          onPick={({ product }) => {
            if (product && picking !== null) update(picking, { product, learned: false });
            setPicking(null);
          }}
        />
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <ReceiptScreen />
      </Suspense>
    </AppShell>
  );
}
