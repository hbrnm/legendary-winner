"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useApp } from "@/components/app/app-provider";
import { useAction } from "@/components/app/hooks";
import { RecipeEditor } from "@/components/recipes/recipe-editor";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, TextArea } from "@/components/ui/fields";
import { callImportRecipe } from "@/lib/supabase/client";
import { productMap } from "@/lib/services/queries";
import { draftFromLink, draftFromPastedText, prepareImport, type PreparedImport } from "@/lib/services/recipe-import";
import type { EditorSource } from "@/components/recipes/recipe-editor";

type Mode = "link" | "text";

/**
 * „Importă rețetă” (.tasks/009, etapa 3): linkul unei pagini cu rețetă (prin
 * serverul aplicației, doar cu cont) sau textul lipit (în telefon, și offline).
 * Rețeta citită se deschide în formular, pentru verificare și salvare.
 */
function Importer() {
  const router = useRouter();
  const { mode: appMode } = useApp();
  const { run, busy } = useAction();
  const [mode, setMode] = useState<Mode>("link");
  const [link, setLink] = useState("");
  const [text, setText] = useState("");
  const [ready, setReady] = useState<{ prepared: PreparedImport; source: EditorSource } | null>(null);
  const linkWorks = appMode === "cloud";

  async function read() {
    const result = await run(async (ctx) => {
      const draft = mode === "link" ? await draftFromLink(link, callImportRecipe) : draftFromPastedText(text);
      const prepared = await prepareImport(ctx, draft);
      return { prepared, source: { products: await productMap(ctx.db, ctx.householdId), recipe: null, ingredients: [], steps: [] } };
    });
    if (result) setReady(result);
  }

  if (ready) return <RecipeEditor id={null} isGlobal={false} source={ready.source} imported={ready.prepared} onBack={() => setReady(null)} />;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void read();
      }}
    >
      <div className="mb-4 flex items-center gap-1">
        <button type="button" onClick={() => router.back()} aria-label="Înapoi" className="-ml-2 inline-flex h-11 w-11 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl font-semibold tracking-tight">Importă rețetă</h1>
      </div>

      <Segmented<Mode>
        label="De unde iei rețeta"
        value={mode}
        onChange={setMode}
        options={[
          { value: "link", label: "Link" },
          { value: "text", label: "Text" },
        ]}
      />

      <div className="mt-4 flex flex-col gap-4">
        {mode === "link" ? (
          <>
            <Field label="Linkul rețetei" htmlFor="import-link" hint="Merge cu site-urile de rețete. Pentru Instagram, TikTok sau Facebook, copiază descrierea și lipește-o la „Text”.">
              <Input id="import-link" type="url" inputMode="url" placeholder="https://" value={link} onChange={(e) => setLink(e.target.value)} disabled={!linkWorks} />
            </Field>
            {!linkWorks && <p className="rounded-xl bg-info-soft px-3 py-2 text-sm text-info">Importul din link merge când ești conectat cu cont. Până atunci, lipește textul rețetei la „Text”.</p>}
          </>
        ) : (
          <Field label="Textul rețetei" htmlFor="import-text" hint="Pune numele pe primul rând, apoi ingredientele și pașii. Merge și fără internet.">
            <TextArea id="import-text" value={text} onChange={(e) => setText(e.target.value)} className="min-h-64" maxLength={20000} />
          </Field>
        )}
        <Button type="submit" block size="lg" disabled={busy || (mode === "link" ? !linkWorks || !link.trim() : !text.trim())}>
          {busy ? "Citesc rețeta…" : "Citește rețeta"}
        </Button>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Importer />
    </AppShell>
  );
}
