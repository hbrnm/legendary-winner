"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/components/app/app-provider";
import { callImportRecipe } from "@/lib/supabase/client";
import { resizePhoto } from "@/lib/photo-resize";
import { photoFromLink, IMPORT_PHOTO_ERROR } from "@/lib/services/recipe-import";
import type { NewRecipePhoto } from "@/lib/services/recipe-photos";

type State = { kind: "loading" } | { kind: "ready"; src: string } | { kind: "failed" } | { kind: "removed" };

/**
 * Fotografia rețetei importate din link (.tasks/013): adusă prin server,
 * micșorată pe telefon ca o poză din galerie și arătată pe „Verifică rețeta”.
 * `onChange` primește poza gata de salvat (sau null după „Scoate fotografia”).
 */
export function ImportedPhoto({ imageUrl, site, onChange }: { imageUrl: string; site: string; onChange: (photo: Omit<NewRecipePhoto, "recipeId"> | null) => void }) {
  const { mode } = useApp();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    if (mode !== "cloud") return;
    let src: string | null = null;
    let stop = false;
    void (async () => {
      try {
        const blob = await photoFromLink(imageUrl, callImportRecipe);
        const photo = await resizePhoto(blob, "");
        if (!photo) throw new Error("poza nu se poate citi");
        if (stop) return;
        src = URL.createObjectURL(new Blob([photo.data], { type: photo.contentType }));
        setState({ kind: "ready", src });
        onChange({ data: photo.data, contentType: photo.contentType, width: photo.width, height: photo.height });
      } catch {
        if (!stop) setState({ kind: "failed" });
      }
    })();
    return () => {
      stop = true;
      if (src) URL.revokeObjectURL(src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- o dată, pentru poza rețetei importate
  }, [imageUrl, mode]);

  // Fără server (modul demonstrativ) nu se poate aduce; importul din link cere oricum cont.
  if (mode !== "cloud" || state.kind === "removed") return null;
  if (state.kind === "loading") return <p className="mb-4 text-sm text-ink-3">Aduc fotografia…</p>;
  if (state.kind === "failed")
    return (
      <p role="note" className="mb-4 rounded-lg bg-warn-soft px-3 py-2 text-sm text-ink">
        {IMPORT_PHOTO_ERROR}
      </p>
    );
  return (
    <figure className="mb-4">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.src} alt="" className="aspect-[4/3] w-full rounded-lg object-cover" />
      <figcaption className="mt-1 flex items-center justify-between gap-2 text-sm text-ink-2">
        <span className="min-w-0 truncate">Fotografia de pe {site}</span>
        <button
          type="button"
          onClick={() => {
            setState({ kind: "removed" });
            onChange(null);
          }}
          className="h-11 shrink-0 rounded-lg px-2 text-brand hover:bg-surface-2"
        >
          Scoate fotografia
        </button>
      </figcaption>
    </figure>
  );
}
