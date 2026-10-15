"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Camera, RefreshCw, Trash2 } from "lucide-react";
import type { Recipe, RecipePhoto } from "@/lib/domain/types";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { ConfirmSheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { activeRecipePhoto, addRecipePhoto, recipePhotoBlob, removeRecipePhoto } from "@/lib/services/recipe-photos";
import { resizePhoto } from "@/lib/photo-resize";
import { RecipePhotoCredit, RecipeVisual, visualDims, type RecipeVisualSize } from "./recipe-visual";

// Fotografia gospodăriei la o rețetă (.tasks/008, etapa 5): are întâietate
// față de cea din catalog. Textele aprobate de proprietar, 15 oct. 2026.

/** Fotografia activă a gospodăriei la rețetă, cu adresa ei locală (blob) și dacă încă n-a urcat. */
export function useHouseholdPhoto(recipeId: string): { photo: RecipePhoto | null; pending: boolean; src: string | null } {
  const { ctx, photos } = useApp();
  const data = useData(
    async (c) => {
      const photo = await activeRecipePhoto(c, recipeId);
      // Doar numărul, nu rândul: rândul ține tot fișierul.
      return { photo, pending: !!photo && c.sync && (await c.db.photo_uploads.where("photo_id").equals(photo.id).count()) > 0 };
    },
    [recipeId],
  );
  const photo = data?.photo ?? null;
  const [loaded, setLoaded] = useState<{ id: string; src: string } | null>(null);
  useEffect(() => {
    if (!photo || !ctx) return;
    let url: string | null = null;
    let cancelled = false;
    void recipePhotoBlob(ctx, photo, photos).then((blob) => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setLoaded({ id: photo.id, src: url });
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setLoaded(null);
    };
    // Același rând (id) are mereu același fișier; ctx și photos nu schimbă fișierul.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.id]);
  return { photo, pending: data?.pending ?? false, src: photo && loaded?.id === photo.id ? loaded.src : null };
}

/** Imaginea rețetei în liste și pe pagina ei: a gospodăriei, altfel cea din catalog, altfel nimic. */
export function RecipeImage({ recipe, size = "md" }: { recipe: Pick<Recipe, "id" | "image_url">; size?: RecipeVisualSize }) {
  const { src } = useHouseholdPhoto(recipe.id);
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" className={`${visualDims(size)} shrink-0 object-cover`} />;
  return <RecipeVisual recipe={recipe} size={size} />;
}

function subscribeOnline(fn: () => void) {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
}

/** Fotografia mare de pe pagina rețetei, cu butoanele pentru fotografia gospodăriei. */
export function RecipePhotoPanel({ recipe }: { recipe: Pick<Recipe, "id" | "image_url"> }) {
  const { photos } = useApp();
  const { photo, pending, src } = useHouseholdPhoto(recipe.id);
  const { run, busy } = useAction();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [resizing, setResizing] = useState(false);
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);

  async function onFile(file: File | undefined) {
    if (input.current) input.current.value = "";
    if (!file) return;
    setResizing(true);
    const resized = await resizePhoto(file, recipe.id).catch(() => null);
    setResizing(false);
    if (!resized) {
      toast("Nu am putut folosi această fotografie. Încearcă alta.", { tone: "error" });
      return;
    }
    await run((ctx) => addRecipePhoto(ctx, resized), "Am pus fotografia.");
  }

  return (
    <>
      <RecipeImage recipe={recipe} size="lg" />
      {!src && <RecipePhotoCredit recipe={recipe} />}
      {photo && pending && (
        <p className="mt-1 text-xs text-ink-2" role="status">
          {online ? "Se încarcă…" : "Se încarcă când ai internet. Membrii gospodăriei o vor vedea atunci."}
        </p>
      )}
      {photos.enabled && (
        <div className="mt-2 flex flex-wrap gap-2">
          {/* Fără `capture`: telefonul oferă singur „Fă o poză” sau „Alege din galerie”. */}
          <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" data-testid="fotografie-fisier" onChange={(e) => void onFile(e.target.files?.[0])} />
          <Button variant="secondary" size="md" icon={photo ? <RefreshCw size={18} /> : <Camera size={18} />} disabled={busy || resizing} onClick={() => input.current?.click()}>
            {photo ? "Schimbă fotografia" : "Adaugă fotografia ta"}
          </Button>
          {photo && (
            <Button variant="ghost" size="md" icon={<Trash2 size={18} />} disabled={busy || resizing} onClick={() => setConfirm(true)}>
              Șterge fotografia
            </Button>
          )}
        </div>
      )}
      {photo && (
        <ConfirmSheet
          open={confirm}
          onClose={() => setConfirm(false)}
          title="Ștergi fotografia?"
          message="Fotografia dispare de pe telefoanele tuturor membrilor."
          confirmLabel="Șterge"
          onConfirm={async () => {
            await run((ctx) => removeRecipePhoto(ctx, photo.id));
          }}
        />
      )}
    </>
  );
}
