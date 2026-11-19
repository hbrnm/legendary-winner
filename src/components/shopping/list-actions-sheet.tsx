"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, History, ListFilter } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LabeledInput } from "@/components/ui/fields";
import { Spinner } from "@/components/ui/misc";
import { useAction, useData } from "@/components/app/hooks";
import { useActiveShoppingList } from "./active-list-provider";
import { copyShoppingSource, type ShoppingSource } from "@/lib/services/shopping";
import { owned, visible } from "@/lib/services/queries";
import { formatLongDate, localDateOf } from "@/lib/domain/dates";
import { formatRon } from "@/lib/domain/money";
import { capitalizeFirst } from "@/lib/domain/text";

export interface ListActionsSheetProps {
  open: boolean;
  onClose: () => void;
}

interface SourceChoice {
  source: ShoppingSource;
  title: string;
  subtitle: string;
}

export function ListActionsSheet({ open, onClose }: ListActionsSheetProps) {
  const router = useRouter();
  const { run, busy } = useAction();
  const { selectList } = useActiveShoppingList();

  const [selected, setSelected] = useState<SourceChoice | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setSelected(null);
    setName("");
    setError(null);
  };

  const handleClose = () => {
    if (busy) return;
    resetState();
    onClose();
  };

  const data = useData(
    async (ctx) => {
      const [lists, transactions, retailers] = await Promise.all([
        owned(ctx.db, "shopping_lists", ctx.householdId),
        owned(ctx.db, "shopping_transactions", ctx.householdId),
        visible(ctx.db, "retailers", ctx.householdId),
      ]);
      const retMap = new Map(retailers.map((r) => [r.id, r.name]));

      const listSources: SourceChoice[] = lists
        .filter((l) => !l.deleted_at)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .map((l) => ({
          source: { kind: "list", id: l.id },
          title: l.name,
          subtitle: l.archived_at ? "Pusă deoparte" : l.is_recurring ? "Se reia" : "Listă de cumpărături",
        }));

      const txSources: SourceChoice[] = transactions
        .filter((t) => !t.deleted_at && t.completed_at)
        .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
        .slice(0, 10)
        .map((t) => {
          const place = t.retailer_id ? retMap.get(t.retailer_id) : null;
          const date = capitalizeFirst(formatLongDate(localDateOf(t.completed_at ?? t.started_at)));
          return {
            source: { kind: "transaction", id: t.id },
            title: place ? `Cumpărături ${place}` : "Cumpărături",
            subtitle: `${date}${t.declared_total != null ? ` · ${formatRon(t.declared_total)}` : ""}`,
          };
        });

      return { listSources, txSources };
    },
    [open]
  );

  function pickSource(choice: SourceChoice) {
    setSelected(choice);
    setName(`${choice.title} (copie)`.slice(0, 80));
    setError(null);
  }

  async function handleCopy() {
    if (!selected) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Scrie numele listei.");
      return;
    }

    const newId = await run(
      (ctx) => copyShoppingSource(ctx, selected.source, trimmed),
      "Am creat copia listei."
    );

    if (newId) {
      selectList(newId);
      resetState();
      onClose();
      router.push(`/cumparaturi/lista/?id=${newId}`);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={handleClose}
      title="Copiază o listă mai veche"
      footer={
        selected ? (
          <div className="flex flex-col gap-2 w-full">
            <Button block disabled={busy} onClick={handleCopy}>
              {busy ? "Se creează…" : "Creează copia"}
            </Button>
            <Button variant="ghost" block disabled={busy} onClick={() => setSelected(null)}>
              Alege altă sursă
            </Button>
          </div>
        ) : undefined
      }
    >
      {!data || !data.listSources ? (
        <Spinner />
      ) : selected ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-2 p-3 text-sm">
            <p className="font-semibold text-ink">{selected.title}</p>
            <p className="text-xs text-ink-2">{selected.subtitle}</p>
          </div>
          <LabeledInput
            label="Numele noii liste"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            maxLength={80}
            autoFocus
          />
          {error && <p role="alert" className="text-sm text-accent">{error}</p>}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-ink-2">
            Alege o listă sau o cumpărătură anterioară pentru a începe o listă nouă cu aceleași produse, fără bife și fără prețuri plătite.
          </p>

          {(data.listSources?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-2">
                <ListFilter size={14} /> Liste
              </h3>
              <ul className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2">
                {data.listSources.map((choice) => (
                  <li key={choice.source.id}>
                    <button
                      type="button"
                      onClick={() => pickSource(choice)}
                      className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium text-ink">{choice.title}</p>
                        <p className="text-xs text-ink-2">{choice.subtitle}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-ink-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data.txSources?.length ?? 0) > 0 && (
            <div>
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-2">
                <History size={14} /> Din istoric
              </h3>
              <ul className="divide-y divide-line overflow-hidden rounded-[20px] bg-surface-2">
                {data.txSources.map((choice) => (
                  <li key={choice.source.id}>
                    <button
                      type="button"
                      onClick={() => pickSource(choice)}
                      className="flex w-full items-center justify-between p-3.5 text-left transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="font-medium text-ink">{choice.title}</p>
                        <p className="text-xs text-ink-2">{choice.subtitle}</p>
                      </div>
                      <ChevronRight size={18} className="shrink-0 text-ink-3" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data.listSources?.length ?? 0) === 0 && (data.txSources?.length ?? 0) === 0 && (
            <p className="text-center text-sm text-ink-2 py-4">Nu există încă liste sau cumpărături anterioare de copiat.</p>
          )}
        </div>
      )}
    </Sheet>
  );
}
