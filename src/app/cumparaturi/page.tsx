"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AgainIcon, BasketIcon } from "@/components/ui/icons";
import { AppShell } from "@/components/app/shell";
import { useActiveShoppingList } from "@/components/shopping/active-list-provider";
import { useAction, useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Spinner } from "@/components/ui/misc";
import { listItems, owned, priceIndex, visible } from "@/lib/services/queries";
import { createList, restoreList } from "@/lib/services/shopping";
import { listTotals } from "@/lib/domain/shopping";
import { formatRon } from "@/lib/domain/money";
import { formatShortDate, toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";

function ListsScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showAll = searchParams.get("toate") === "1";
  const isNew = searchParams.get("nou") === "1";
  const handledNew = useRef(false);

  const { activeListId, selectList, ready } = useActiveShoppingList();
  const { run } = useAction();
  const [showArchived, setShowArchived] = useState(false);

  const data = useData(async (ctx) => {
    const lists = (await owned(ctx.db, "shopping_lists", ctx.householdId)).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const prices = await priceIndex(ctx.db, ctx.householdId);
    const retailers = (await visible(ctx.db, "retailers", ctx.householdId)).sort((a, b) => a.name.localeCompare(b.name, "ro"));
    const withTotals = await Promise.all(lists.map(async (l) => ({ list: l, totals: listTotals(await listItems(ctx.db, l.id), prices) })));
    return { lists: withTotals, retailers };
  });

  useEffect(() => {
    if (!ready || !data) return;

    if (isNew && !handledNew.current) {
      handledNew.current = true;
      void run(async (ctx) => {
        const datedName = `Cumpărături ${formatShortDate(toISODate(now()))}`;
        const id = await createList(ctx, { name: datedName });
        selectList(id);
        router.replace(`/cumparaturi/lista/?id=${id}`);
      });
      return;
    }

    if (!showAll && !isNew) {
      const activeLists = data.lists.filter((x) => !x.list.archived_at);
      const targetId = activeListId || activeLists[0]?.list.id;
      if (targetId) {
        router.replace(`/cumparaturi/lista/?id=${targetId}`);
      }
    }
  }, [ready, data, isNew, showAll, activeListId, selectList, router, run]);

  if (!data) return <Spinner />;

  const active = data.lists.filter((x) => !x.list.archived_at);
  const archived = data.lists.filter((x) => x.list.archived_at).sort((a, b) => (b.list.archived_at ?? "").localeCompare(a.list.archived_at ?? ""));
  const retailerName = new Map(data.retailers.map((r) => [r.id, r.name]));

  // If redirecting to active list, don't flash all lists
  if (!showAll && !isNew && active.length > 0) {
    return <Spinner />;
  }

  return (
    <>
      <PageHeader
        title="Cumpărături"
        subtitle="Ce e de luat, pentru toată casa"
      />

      {active.length === 0 ? (
        <EmptyState
          icon={<BasketIcon size={32} />}
          title="Încă n-ai nicio listă"
        >
          Apasă pe butonul de adăugare (+) pentru a crea o listă nouă sau pentru a copia o listă mai veche.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 min-[900px]:grid-cols-2">
          {active.map(({ list, totals }) => (
            <li key={list.id}>
              <Link href={`/cumparaturi/lista/?id=${list.id}`} className="block" onClick={() => selectList(list.id)}>
                <Card className="flex items-center gap-3 p-5 transition-colors hover:bg-surface-container-high">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="line-clamp-2 break-words font-sans text-lg font-semibold leading-snug">{list.name}</span>
                      {list.is_recurring && (
                        <Badge tone="brand">
                          <AgainIcon size={12} strokeWidth={2} /> se reia
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-2 tabular">
                      {totals.item_count === 0 ? "Încă goală" : `${totals.checked_count} din ${totals.item_count} în coș${totals.projected_total > 0 ? ` · ~${formatRon(totals.projected_total)}` : ""}`}
                      {list.default_retailer_id && ` · ${retailerName.get(list.default_retailer_id) ?? ""}`}
                    </p>
                    {totals.item_count > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <div className="h-full rounded-full bg-sprout" style={{ width: `${(totals.checked_count / totals.item_count) * 100}%` }} />
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

      {archived.length > 0 && (
        <>
          <SectionTitle
            action={
              <Button variant="ghost" size="sm" onClick={() => setShowArchived((v) => !v)}>
                {showArchived ? "Ascunde-le" : `Arată-le (${archived.length})`}
              </Button>
            }
          >
            Puse deoparte
          </SectionTitle>
          {showArchived && (
            <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-[20px] bg-surface">
              {archived.map(({ list, totals }) => (
                <li key={list.id} className="flex items-center gap-2 px-4 py-2">
                  <Link href={`/cumparaturi/lista/?id=${list.id}`} className="min-w-0 flex-1 py-1">
                    <span className="line-clamp-2 text-[15px] leading-snug">{list.name}</span>
                    <span className="text-xs text-ink-2 tabular">{formatRon(totals.spent)} cheltuit</span>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => run((ctx) => restoreList(ctx, list.id), "Lista e din nou activă.")}>
                    Pune la loc
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <Suspense fallback={<Spinner />}>
        <ListsScreen />
      </Suspense>
    </AppShell>
  );
}
