"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/fields";
import { kcalFormat, type ProductNutritionSuggestion } from "@/lib/domain/calories";
import { isGtin } from "@/lib/domain/barcode";
import type { NutritionValues } from "@/lib/domain/recipes";
import { callLookupNutrition } from "@/lib/supabase/client";
import { BarcodeCamera } from "./barcode-camera";

export const NUTRIENT_FIELDS = [
  ["kcal", "Energie"],
  ["protein_g", "Proteine"],
  ["carbs_g", "Glucide"],
  ["fat_g", "Grăsimi"],
] as const;

export function NutritionNumbers({ values, fiber }: { values: NutritionValues; fiber?: number }) {
  return (
    <dl className="space-y-1 text-sm">
      {NUTRIENT_FIELDS.map(([key, label]) => (
        <div key={key} className="flex justify-between gap-1">
          <dt>{label}</dt>
          <dd className="font-semibold tabular">{kcalFormat.format(values[key])} {key === "kcal" ? "kcal" : "g"}</dd>
        </div>
      ))}
      {fiber != null && <div className="flex justify-between gap-1"><dt>Fibre</dt><dd className="font-semibold tabular">{kcalFormat.format(fiber)} g</dd></div>}
    </dl>
  );
}

export function BarcodeLookup({
  initialCode = "",
  cloudAvailable,
  findLocal,
  requireNutritionForAccept = true,
  acceptLabel,
  onAccept,
  startWithCamera = false,
}: {
  initialCode?: string;
  cloudAvailable: boolean;
  findLocal?: (gtin: string) => ProductNutritionSuggestion | null;
  requireNutritionForAccept?: boolean;
  acceptLabel: string;
  onAccept: (suggestion: ProductNutritionSuggestion) => void;
  startWithCamera?: boolean;
}) {
  const [code, setCode] = useState(initialCode);
  const [suggestion, setSuggestion] = useState<ProductNutritionSuggestion | null>(null);
  const [lookup, setLookup] = useState(false);
  const [status, setStatus] = useState("");
  const [cameraOpen, setCameraOpen] = useState(startWithCamera);
  const closeCamera = useCallback(() => setCameraOpen(false), []);

  const setBarcode = useCallback((value: string) => {
    setCode(value);
    setSuggestion(null);
    setStatus("");
  }, []);

  async function search(overrideCode?: string) {
    const gtin = (overrideCode ?? code).trim();
    setSuggestion(null);
    if (!isGtin(gtin)) {
      setStatus("Verifică cifrele codului de bare.");
      return;
    }

    const local = findLocal?.(gtin) ?? null;
    if (local?.nutrition) {
      setSuggestion(local);
      setStatus("Compară produsul, gramajul și valorile cu ambalajul.");
      return;
    }

    if (!cloudAvailable) {
      if (local) {
        setSuggestion(local);
        setStatus("Datele nutriționale sunt incomplete. Completează caloriile manual.");
      } else {
        setStatus("Codul nu a fost găsit local. Conectează-te pentru Open Food Facts sau scrie manual.");
      }
      return;
    }

    setLookup(true);
    setStatus("Se caută produsul…");
    try {
      const response = await callLookupNutrition(gtin);
      if (response.status === 429) {
        setStatus("Încearcă din nou peste câteva secunde. Poți completa și manual.");
        return;
      }
      if (!response.ok) throw new Error("lookup");
      const { product: found } = await response.json() as { product: ProductNutritionSuggestion | null };
      const picked = found ?? local;
      setSuggestion(picked);
      setStatus(
        picked
          ? picked.nutrition
            ? "Compară produsul, gramajul și valorile cu ambalajul."
            : "Datele nutriționale sunt incomplete. Completează valorile de pe ambalaj."
          : "Codul nu a fost găsit. Poți completa valorile de pe ambalaj.",
      );
    } catch {
      if (local) {
        setSuggestion(local);
        setStatus("Căutarea online nu este disponibilă. Am găsit produsul în catalog.");
      } else {
        setStatus("Căutarea nu este disponibilă acum. Poți completa valorile manual.");
      }
    } finally {
      setLookup(false);
    }
  }

  const acceptScan = useCallback((value: string) => {
    setBarcode(value);
    closeCamera();
    setStatus("Cod citit. Apasă «Caută produsul» pentru a verifica rezultatul.");
  }, [closeCamera, setBarcode]);

  const title = suggestion ? [suggestion.name, suggestion.brand, suggestion.quantity].filter(Boolean).join(" · ") || suggestion.code : "";
  const isLocalFallback = suggestion ? !suggestion.nutrition && Boolean(findLocal?.(suggestion.code)) : false;

  return (
    <div className="space-y-3">
      <LabeledInput
        label="Cod de bare"
        inputMode="numeric"
        maxLength={14}
        value={code}
        disabled={lookup}
        onChange={(event) => setBarcode(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (!lookup && !cameraOpen) void search();
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="auto" variant="outlined" disabled={lookup || cameraOpen} onClick={() => void search()}>
          Caută produsul
        </Button>
        {!cameraOpen && (
          <Button type="button" size="auto" variant="ghost" disabled={lookup} onClick={() => setCameraOpen(true)}>
            Scanează codul
          </Button>
        )}
      </div>
      {cameraOpen && <BarcodeCamera onRead={acceptScan} onClose={closeCamera} />}
      {status && <p role="status" className="text-sm text-ink-2">{status}</p>}
      {suggestion && (
        <div className="space-y-2">
          <p className="font-semibold">{title}</p>
          {!isLocalFallback && (
            <a className="text-sm text-brand underline" href={`https://world.openfoodfacts.org/product/${suggestion.code}`} target="_blank" rel="noreferrer">
              Sursă Open Food Facts · ODbL
            </a>
          )}
          {suggestion.nutrition && (
            <>
              <p className="text-sm">La 100 {suggestion.nutrition.basis}</p>
              <NutritionNumbers values={suggestion.nutrition.values} />
            </>
          )}
          {(suggestion.nutrition || !requireNutritionForAccept) && (
            <Button
              type="button"
              size="auto"
              variant="tonal"
              onClick={() => {
                onAccept(suggestion);
                setSuggestion(null);
              }}
            >
              {acceptLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
