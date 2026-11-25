"use client";

import { useState } from "react";
import { Trash2 } from "@/components/ui/icons";
import { useAction } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelect, Segmented } from "@/components/ui/fields";
import { Sheet } from "@/components/ui/sheet";
import { createBudget, deleteBudget, updateBudget } from "@/lib/services/money";
import { parseMoney } from "@/lib/domain/money";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId } from "@/lib/domain/expense-categories";
import type { Budget, BudgetPeriod, BudgetScope, ProductCategory, PurchaseSource, Retailer } from "@/lib/domain/types";

export type ScopeKind = BudgetScope["kind"];

export interface BudgetEditorSheetProps {
  editing: Budget | "nou" | null;
  onClose: () => void;
  categories: ProductCategory[];
  retailers: Retailer[];
  isFirstBudget: boolean;
  initialScope?: BudgetScope;
  initialName?: string;
  onOpenIncome?: () => void;
}

export function scopeLabel(
  scope: BudgetScope,
  names: { categories: Map<string, string>; retailers: Map<string, string> },
): string {
  switch (scope.kind) {
    case "familie":
      return "Toate cheltuielile familiei";
    case "cheltuiala":
      return EXPENSE_CATEGORIES.find((category) => category.id === scope.category_id)?.name ?? "Categorie de cheltuieli";
    case "total":
      return "Toate cumpărăturile";
    case "alimente":
      return "Doar alimente";
    case "nealimentare":
      return "Casă și igienă (nealimentare)";
    case "sursa":
      return scope.source === "piata" ? "Piață și producători locali" : "Supermarket";
    case "categorie":
      return names.categories.get(scope.category_id) ?? "Categorie";
    case "magazin":
      return names.retailers.get(scope.retailer_id) ?? "Magazin";
  }
}

function BudgetEditorForm({
  editing,
  onClose,
  categories,
  retailers,
  isFirstBudget,
  initialScope,
  initialName,
  onOpenIncome,
}: BudgetEditorSheetProps & { editing: Budget | "nou" }) {
  const { run, busy } = useAction();
  const [fName, setFName] = useState(() => (editing === "nou" ? (initialName ?? (isFirstBudget ? "Bugetul lunii" : "")) : editing.name));
  const [fAmount, setFAmount] = useState(() => (editing === "nou" ? "" : editing.amount.toFixed(2).replace(".", ",")));
  const [fPeriod, setFPeriod] = useState<BudgetPeriod>(() => (editing === "nou" ? "lunar" : editing.period));
  const seedScope = editing === "nou" ? initialScope : editing.scope;
  const [fKind, setFKind] = useState<ScopeKind>(() => seedScope?.kind ?? "familie");
  const [fValue, setFValue] = useState(() =>
    !seedScope
      ? ""
      : seedScope.kind === "sursa"
        ? seedScope.source
        : seedScope.kind === "categorie" || seedScope.kind === "cheltuiala"
          ? seedScope.category_id
          : seedScope.kind === "magazin"
            ? seedScope.retailer_id
            : "",
  );
  const [formError, setFormError] = useState<string | null>(null);

  const names = {
    categories: new Map(categories.map((c) => [c.id, c.name])),
    retailers: new Map(retailers.map((r) => [r.id, r.name])),
  };

  async function save() {
    const amount = parseMoney(fAmount);
    if (amount == null || amount <= 0) return setFormError("Scrie suma bugetului, de exemplu 2500.");
    let scope: BudgetScope;
    if (fKind === "sursa") scope = { kind: "sursa", source: (fValue || "piata") as PurchaseSource };
    else if (fKind === "categorie") {
      if (!fValue) return setFormError("Alege categoria.");
      scope = { kind: "categorie", category_id: fValue };
    } else if (fKind === "cheltuiala") {
      if (!fValue || !EXPENSE_CATEGORIES.some((category) => category.id === fValue)) return setFormError("Alege categoria.");
      scope = { kind: "cheltuiala", category_id: fValue as ExpenseCategoryId };
    } else if (fKind === "magazin") {
      if (!fValue) return setFormError("Alege magazinul.");
      scope = { kind: "magazin", retailer_id: fValue };
    } else scope = { kind: fKind };
    const input = { name: fName || scopeLabel(scope, names), period: fPeriod, scope, amount };
    const ok = await run(async (ctx) => {
      if (editing === "nou") await createBudget(ctx, input);
      else await updateBudget(ctx, (editing as Budget).id, input);
      return true;
    }, "Am salvat bugetul.");
    if (ok) onClose();
  }

  return (
    <Sheet
      open={true}
      onClose={onClose}
      title={editing === "nou" ? "Buget nou" : "Modifică bugetul"}
      footer={
        <div className="flex gap-2">
          {editing !== "nou" && (
            <Button
              variant="danger"
              icon={<Trash2 size={18} />}
              onClick={async () => {
                await run((ctx) => deleteBudget(ctx, (editing as Budget).id), "Am șters bugetul.");
                onClose();
              }}
            >
              Șterge
            </Button>
          )}
          <Button className="min-w-0 flex-1 px-3" onClick={save} disabled={busy}>
            Salvează
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <LabeledInput
          label="Suma (lei)"
          inputMode="decimal"
          value={fAmount}
          onChange={(e) => {
            setFAmount(e.target.value);
            setFormError(null);
          }}
          placeholder="ex. 2500"
          autoFocus
          error={formError}
        />
        <Segmented<BudgetPeriod>
          label="Perioada"
          value={fPeriod}
          onChange={setFPeriod}
          options={[
            { value: "lunar", label: "Pe lună" },
            { value: "saptamanal", label: "Pe săptămână" },
          ]}
        />
        <LabeledSelect
          label="Pentru"
          value={fKind}
          onChange={(e) => {
            setFKind(e.target.value as ScopeKind);
            setFValue("");
          }}
        >
          <option value="familie">Toate cheltuielile familiei</option>
          <option value="cheltuiala">O categorie de cheltuieli</option>
          <option value="total">Toate cumpărăturile</option>
          <option value="alimente">Doar alimente</option>
          <option value="nealimentare">Casă și igienă (nealimentare)</option>
          <option value="sursa">Supermarket sau piață</option>
          <option value="categorie">O categorie</option>
          <option value="magazin">Un magazin</option>
        </LabeledSelect>
        {fKind === "sursa" && (
          <LabeledSelect label="Sursa" value={fValue || "piata"} onChange={(e) => setFValue(e.target.value)}>
            <option value="supermarket">Supermarket</option>
            <option value="piata">Piață și producători locali</option>
            <option value="alta">Altă sursă</option>
          </LabeledSelect>
        )}
        {fKind === "cheltuiala" && (
          <LabeledSelect label="Categoria" value={fValue} onChange={(event) => setFValue(event.target.value)}>
            <option value="">Alege…</option>
            {EXPENSE_CATEGORIES.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </LabeledSelect>
        )}
        {fKind === "categorie" && (
          <LabeledSelect label="Categoria" value={fValue} onChange={(e) => setFValue(e.target.value)}>
            <option value="">Alege…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </LabeledSelect>
        )}
        {fKind === "magazin" && (
          <LabeledSelect label="Magazinul" value={fValue} onChange={(e) => setFValue(e.target.value)}>
            <option value="">Alege…</option>
            {retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </LabeledSelect>
        )}
        <LabeledInput
          label="Nume (opțional)"
          value={fName}
          onChange={(e) => setFName(e.target.value)}
          maxLength={60}
          placeholder="ex. Piața din weekend"
        />
        {fKind === "familie" && onOpenIncome && (
          <div className="pt-1">
            <Button
              type="button"
              variant="secondary"
              block
              onClick={() => {
                onClose();
                onOpenIncome();
              }}
            >
              Configurează veniturile lunare
            </Button>
          </div>
        )}
        <p className="text-xs text-ink-2">
          Bugetul e suma planificată. Cheltuiala reală include plățile manuale și produsele bifate la cumpărături, potrivit categoriei alese.
        </p>
      </div>
    </Sheet>
  );
}

export function BudgetEditorSheet(props: BudgetEditorSheetProps) {
  if (!props.editing) return null;
  const key = props.editing === "nou" ? "nou" : props.editing.id;
  return <BudgetEditorForm key={key} {...props} editing={props.editing} />;
}
