"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, History, Plus, Repeat, ShoppingBasket } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useAction, useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect, Toggle } from "@/components/ui/fields";
import { listItems, owned, priceIndex, visible } from "@/lib/services/queries";
import { createList, restoreList } from "@/lib/services/shopping";
import { listTotals } from "@/lib/domain/shopping";
import { formatRon } from "@/lib/domain/money";

const SUGGESTED_NAMES = ["Cumpărături săptămânale", "Piață", "Lidl", "Kaufland", "Cumpărături urgente", "Weekend"];

function ListsScreen() {
  const router = useRouter();
  const { run, busy } = useAction();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [retailerId, setRetailerId] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const data = useData(async (ctx) => {
    const lists = (await owned(ctx.db, "shopping_lists", ctx.householdId)).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const prices = await priceIndex(ctx.db, ctx.householdId);
    const retailers = (await visible(ctx.db, "retailers", ctx.householdId)).sort((a, b) => a.name.localeCompare(b.name, "ro"));
    const withTotals = await Promise.all(lists.map(async (l) => ({ list: l, totals: listTotals(await listItems(ctx.db, l.id), prices) })));
    return { lists: withTotals, retailers };
  });

  if (!data) return <Spinner />;
  const active = data.lists.filter((x) => !x.list.archived_at);
  const archived = data.lists.filter((x) => x.list.archived_at).sort((a, b) => (b.list.archived_at ?? "").localeCompare(a.list.archived_at ?? ""));
  const retailerName = new Map(data.retailers.map((r) => [r.id, r.name]));

  async function submit() {
    const id = await run((ctx) => createList(ctx, { name, is_recurring: recurring, default_retailer_id: retailerId || null }));
    if (id) {
      setCreating(false);
      setName("");
      router.push(`/cumparaturi/lista/?id=${id}`);
    }
  }

  return (
    <>
      <PageHeader
        title="Cumpărături"
        subtitle="Listele gospodăriei, la comun"
        action={
          <Button onClick={() => setCreating(true)} icon={<Plus size={18} />}>
            Listă nouă
          </Button>
        }
      />

      {active.length === 0 ? (
        <EmptyState icon={<ShoppingBasket size={32} />} title="Nicio listă activă" action={<Button onClick={() => setCreating(true)}>Creează prima listă</Button>}>
          Fă o listă pentru cumpărăturile săptămânale, una pentru piață sau câte una pentru fiecare magazin.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {active.map(({ list, totals }) => (
            <li key={list.id}>
              <Link href={`/cumparaturi/lista/?id=${list.id}`} className="block">
                <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[17px] font-medium">{list.name}</span>
                      {list.is_recurring && (
                        <Badge tone="brand">
                          <Repeat size={12} /> recurentă
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-2 tabular">
                      {totals.item_count === 0
                        ? "Goală"
                        : `${totals.item_count - totals.checked_count} de luat${totals.checked_count ? ` · ${totals.checked_count} luate` : ""} · ~${formatRon(totals.projected_total)}`}
                      {list.default_retailer_id && ` · ${retailerName.get(list.default_retailer_id) ?? ""}`}
                    </p>
                    {totals.item_count > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <div className="h-full rounded-full bg-brand" style={{ width: `${(totals.checked_count / totals.item_count) * 100}%` }} />
                      </div>
                    )}
                  </div>
                  <ChevronRight size={20} className="shrink-0 text-ink-3" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/cumparaturi/istoric/" className="mt-6 flex min-h-12 items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-[15px] hover:bg-surface-2">
        <History size={20} className="text-ink-2" />
        <span className="flex-1">Istoricul cumpărăturilor</span>
        <ChevronRight size={18} className="text-ink-3" />
      </Link>

      {archived.length > 0 && (
        <>
          <SectionTitle
            action={
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Ascunde" : `Arată (${archived.length})`}
              </Button>
            }
          >
            Liste arhivate
          </SectionTitle>
          {showArchived && (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {archived.map(({ list, totals }) => (
                <li key={list.id} className="flex items-center gap-2 px-4 py-2">
                  <Link href={`/cumparaturi/lista/?id=${list.id}`} className="min-w-0 flex-1 py-1">
                    <span className="block truncate text-[15px]">{list.name}</span>
                    <span className="text-xs text-ink-2 tabular">{formatRon(totals.spent)} cheltuit</span>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => run((ctx) => restoreList(ctx, list.id), "Lista e din nou activă.")}>
                    Reactivează
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Sheet
        open={creating}
        onClose={() => setCreating(false)}
        title="Listă nouă"
        footer={
          <Button block onClick={submit} disabled={busy}>
            Creează lista
          </Button>
        }
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <LabeledInput label="Numele listei" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="ex. Cumpărături săptămânale" autoFocus />
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_NAMES.map((s) => (
              <button key={s} type="button" onClick={() => setName(s)} className="h-9 rounded-full border border-line px-3 text-sm text-ink-2 hover:text-ink">
                {s}
              </button>
            ))}
          </div>
          <LabeledSelect label="Magazin obișnuit (opțional)" value={retailerId} onChange={(e) => setRetailerId(e.target.value)}>
            <option value="">Oriunde</option>
            {data.retailers.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </LabeledSelect>
          <Toggle checked={recurring} onChange={setRecurring} label="Listă recurentă" description="După ce termini cumpărăturile, produsele rămân pe listă, debifate, pentru data viitoare." />
          <button type="submit" className="hidden" />
        </form>
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <ListsScreen />
    </AppShell>
  );
}
