"use client";

import { useId, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, LabeledInput, LabeledSelect, TextArea } from "@/components/ui/fields";
import { useAction, useData } from "@/components/app/hooks";
import { useActiveShoppingList } from "./active-list-provider";
import { productSearchIndex } from "@/lib/services/catalog";
import { owned } from "@/lib/services/queries";
import { addItem, createList } from "@/lib/services/shopping";
import { parseQuickAdd, type QuickAdd } from "@/lib/domain/quick-add";
import { search } from "@/lib/domain/search";
import { formatShortDate, toISODate } from "@/lib/domain/dates";
import { count } from "@/lib/domain/text";
import { now } from "@/lib/clock";

/**
 * Sparge un text lipit din mesaje sau notițe în linii de produse cu cantitate și unitate opționale.
 * Păstrează virgulele zecimale („1,5 kg cartofi”), dar desparte elementele separate prin virgulă („lapte, pâine”).
 */
export function parseImportedListLines(raw: string): QuickAdd[] {
  return raw
    .split(/\r?\n|;|,(?=\s*[^\d\s])/)
    .map((segment) =>
      segment
        .trim()
        .replace(/^(?:[-*•·✓✔☐☑]+\s*|\[\s*[xX✓✔]?\s*\]\s*|\d+[.)]\s+)/, "")
        .trim(),
    )
    .filter(Boolean)
    .map(parseQuickAdd)
    .filter((item) => item.text.length > 0);
}

export function ListImportSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const { run, busy } = useAction();
  const { activeListId, selectList } = useActiveShoppingList();
  const textId = useId();
  const submitting = useRef(false);

  const [selectedListId, setSelectedListId] = useState<string>("");
  const [newListName, setNewListName] = useState(() => `Cumpărături ${formatShortDate(toISODate(now()))}`);
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);

  const data = useData(
    async (ctx) => {
      const [lists, index] = await Promise.all([
        owned(ctx.db, "shopping_lists", ctx.householdId),
        productSearchIndex(ctx),
      ]);
      return {
        lists: lists.filter((l) => !l.archived_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
        index,
      };
    },
    [open],
  );

  const parsedItems = useMemo(() => parseImportedListLines(rawText), [rawText]);

  const routeListId =
    typeof window !== "undefined" && pathname.startsWith("/cumparaturi/lista")
      ? new URLSearchParams(window.location.search).get("id")
      : null;
  const activeLists = data?.lists ?? [];
  const defaultTarget =
    (routeListId && activeLists.some((l) => l.id === routeListId) ? routeListId : null) ??
    (activeListId && activeLists.some((l) => l.id === activeListId) ? activeListId : null) ??
    "nou";
  const effectiveTarget = selectedListId || defaultTarget;

  function handleClose() {
    if (busy || submitting.current) return;
    setError(null);
    onClose();
  }

  async function handleSubmit() {
    if (submitting.current) return;
    if (parsedItems.length === 0) {
      setError("Scrie sau lipește cel puțin un produs.");
      return;
    }
    const creatingNew = effectiveTarget === "nou";
    const trimmedName = newListName.trim();
    if (creatingNew && !trimmedName) {
      setError("Scrie numele listei noi.");
      return;
    }

    submitting.current = true;
    setError(null);
    try {
      const targetId = await run(async (ctx) => {
        const listId = creatingNew ? await createList(ctx, { name: trimmedName }) : effectiveTarget;
        const index = data?.index ?? (await productSearchIndex(ctx));
        for (const item of parsedItems) {
          const [topHit] = search(index, item.text, 1);
          const matchedId = topHit && topHit.score >= 70 ? topHit.doc.id : null;
          await addItem(ctx, listId, {
            product_id: matchedId,
            name: matchedId ? undefined : item.text,
            quantity: item.quantity,
            unit: item.unit,
          });
        }
        return listId;
      }, `Am adăugat ${count(parsedItems.length, "produs", "produse")} pe listă.`);

      if (targetId) {
        selectList(targetId);
        setRawText("");
        setSelectedListId("");
        setNewListName(`Cumpărături ${formatShortDate(toISODate(now()))}`);
        onClose();
        router.push(`/cumparaturi/lista/?id=${targetId}`);
      }
    } finally {
      submitting.current = false;
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Importă listă"
      footer={
        <Button block disabled={busy || parsedItems.length === 0} onClick={() => void handleSubmit()}>
          {busy ? "Se adaugă…" : parsedItems.length > 0 ? `Adaugă ${count(parsedItems.length, "produs", "produse")}` : "Adaugă pe listă"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ink-2">
          Lipește o listă din mesaje sau notițe (câte un produs pe rând ori despărțite prin virgulă). Poți include și cantități, de exemplu „2 kg cartofi”.
        </p>
        <LabeledSelect
          label="Unde adaug produsele"
          value={effectiveTarget}
          onChange={(e) => {
            setSelectedListId(e.target.value);
            setError(null);
          }}
        >
          {activeLists.map((l) => (
            <option key={l.id} value={l.id}>
              Pe lista „{l.name}”
            </option>
          ))}
          <option value="nou">+ Listă nouă</option>
        </LabeledSelect>

        {effectiveTarget === "nou" && (
          <LabeledInput
            label="Numele noii liste"
            value={newListName}
            onChange={(e) => {
              setNewListName(e.target.value);
              setError(null);
            }}
            maxLength={80}
          />
        )}

        <Field
          label="Produse de importat"
          htmlFor={textId}
          hint={parsedItems.length > 0 ? `Am recunoscut ${count(parsedItems.length, "produs", "produse")}.` : undefined}
          error={error}
        >
          <TextArea
            id={textId}
            autoFocus
            rows={7}
            placeholder={"2 kg cartofi\nlapte 2 l\n10 ouă\npâine"}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setError(null);
            }}
          />
        </Field>
      </div>
    </Sheet>
  );
}
