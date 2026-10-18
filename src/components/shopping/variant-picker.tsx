"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect } from "@/components/ui/fields";
import type { ProductVariant } from "@/lib/domain/types";
import { variantLabel } from "@/lib/domain/variants";

export type NetUnit = "g" | "kg" | "ml" | "l";

export interface NewVariant {
  brand: string | null;
  name: string;
  net_quantity: number | null;
  net_unit: NetUnit | null;
  ean: string | null;
}

export interface VariantPickerProps {
  /** Variantele produsului, fără cele șterse. */
  variants: ProductVariant[];
  /** Numele mărcilor, după id. */
  brands: ReadonlyMap<string, string>;
  value: string | null;
  onChange: (id: string | null) => void;
  /** Salvează varianta nouă; întoarce id-ul ei sau null dacă n-a mers (eroarea o arată apelantul). */
  onCreate: (input: NewVariant) => Promise<string | null>;
  label?: string;
  /** Doar butonul „Variantă nouă” și formularul, fără alegere (administrarea catalogului). */
  createOnly?: boolean;
}

const NEW = "_nou";
const NET_UNITS: NetUnit[] = ["g", "kg", "ml", "l"];

/** Alegerea mărcii și a ambalajului (opțional), cu „Variantă nouă” pe loc (.tasks/007). */
export function VariantPicker({
  variants,
  brands,
  value,
  onChange,
  onCreate,
  label = "Marca și ambalajul",
  createOnly,
}: VariantPickerProps) {
  const [adding, setAdding] = useState(false);
  const [brand, setBrand] = useState("");
  const [name, setName] = useState("");
  const [net, setNet] = useState("");
  const [unit, setUnit] = useState<NetUnit>("g");
  const [ean, setEan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add() {
    const q = net.trim() ? Number(net.replace(",", ".")) : null;
    if (!name.trim()) return setError("Scrie numele de pe ambalaj.");
    if (q != null && !(q > 0))
      return setError("Cantitatea netă trebuie să fie mai mare decât zero.");
    setSaving(true);
    const id = await onCreate({
      brand: brand.trim() || null,
      name: name.trim(),
      net_quantity: q,
      net_unit: q == null ? null : unit,
      ean: ean.replace(/\s/g, "") || null,
    });
    setSaving(false);
    if (!id) return;
    onChange(id);
    setAdding(false);
    setBrand("");
    setName("");
    setNet("");
    setEan("");
    setError(null);
  }

  return (
    <div className="flex flex-col gap-3">
      {createOnly ? (
        !adding && (
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Variantă nouă
          </Button>
        )
      ) : (
        <LabeledSelect
          label={label}
          hint="Opțional. Cu gramajul aflăm prețul pe kg și comparăm mărcile."
          value={adding ? NEW : (value ?? "")}
          onChange={(e) => {
            const v = e.target.value;
            setAdding(v === NEW);
            setError(null);
            if (v !== NEW) onChange(v || null);
          }}
        >
          <option value="">Fără marcă anume</option>
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {variantLabel(v, v.brand_id ? brands.get(v.brand_id) : null)}
            </option>
          ))}
          <option value={NEW}>+ Variantă nouă</option>
        </LabeledSelect>
      )}

      {adding && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-3">
          <div className="grid grid-cols-2 gap-2">
            <LabeledInput
              label="Marca"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="ex. Sissi"
              maxLength={80}
            />
            <LabeledInput
              label="Numele de pe ambalaj"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex. Șuncă de pui"
              maxLength={120}
            />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-2">
            <LabeledInput
              label="Cantitatea netă"
              inputMode="decimal"
              value={net}
              onChange={(e) => setNet(e.target.value)}
              placeholder="300"
            />
            <LabeledSelect
              label="unitate"
              value={unit}
              onChange={(e) => setUnit(e.target.value as NetUnit)}
            >
              {NET_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </LabeledSelect>
          </div>
          <LabeledInput
            label="Cod de bare (opțional)"
            inputMode="numeric"
            value={ean}
            onChange={(e) => setEan(e.target.value)}
            maxLength={20}
            error={error}
          />
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setError(null);
              }}
            >
              Renunță
            </Button>
            <Button block onClick={add} disabled={saving}>
              Adaugă varianta
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
