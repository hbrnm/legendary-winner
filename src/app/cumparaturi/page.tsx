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

  async function handleCreateList() {
    await run(async (ctx) => {
      const datedName = `Cumpărături ${formatShortDate(toISODate(now()))}`;
      const id = await createList(ctx, { name: datedName });
      selectList(id);
      router.push(`/cumparaturi/lista/?id=${id}`);
    }, "Am creat lista de cumpărături.");
  }

  const data = useData(async (ctx) => {
    const lists = (await owned(ctx.db, "shopping_lists", ctx.householdId)).sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
    const prices = await priceIndex(ctx.db, ctx.householdId);
    const retailers = (await visible(ctx.db, "retailers", ctx.householdId)).sort((a, b) => a.name.localeCompare(b.name, "ro"));
    const withTotals = await Promise.all(lists.map(async (l) => ({ list: l, totals: listTotals(await listItems(ctx.db, l.id), prices) })));
    return { lists: withTotals, retailers };
  });

  useEffect(() => {
    if (!ready) return;

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
      if (activeListId) {
        router.replace(`/cumparaturi/lista/?id=${activeListId}`);
        return;
      }
      if (data) {
        const activeLists = data.lists.filter((x) => !x.list.archived_at);
        const targetId = activeLists[0]?.list.id;
        if (targetId) {
          router.replace(`/cumparaturi/lista/?id=${targetId}`);
        }
      }
    }
  }, [ready, data, isNew, showAll, activeListId, selectList, router, run]);

  // If redirecting to active list, show spinner and avoid flashing all lists
  if (!showAll && !isNew && (activeListId || (data && data.lists.some((x) => !x.list.archived_at)))) {
    return <Spinner />;
  }

  if (!data) return <Spinner />;

  const active = data.lists.filter((x) => !x.list.archived_at);
  const archived = data.lists.filter((x) => x.list.archived_at).sort((a, b) => (b.list.archived_at ?? "").localeCompare(a.list.archived_at ?? ""));
  const retailerName = new Map(data.retailers.map((r) => [r.id, r.name]));

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
          action={<Button onClick={handleCreateList}>Creează o listă</Button>}
        >
          Apasă pe butonul de mai sus pentru a crea o listă nouă sau folosește butonul (+) pentru a copia o listă mai veche.
        </EmptyState>
      ) : (
        <ul className="grid gap-3.5 min-[900px]:grid-cols-2">
          {active.map(({ list, totals }) => (
            <li key={list.id}>
              <Link href={`/cumparaturi/lista/?id=${list.id}`} className="block" onClick={() => selectList(list.id)}>
                <Card className="group flex items-center gap-3.5 p-4 sm:p-5 transition-all duration-150 ease-out hover:border-outline/40 hover:bg-surface-2/30 active:scale-[0.99]">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-brand transition-colors duration-150 group-hover:bg-brand group-hover:text-brand-ink">
                    <BasketIcon size={22} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="line-clamp-2 break-words font-sans text-lg font-semibold leading-snug text-ink group-hover:text-brand transition-colors">
                        {list.name}
                      </span>
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
                      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <div
                          className="h-full rounded-full bg-sprout transition-[width] duration-300 ease-out"
                          style={{ width: `${(totals.checked_count / totals.item_count) * 100}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <ChevronRight size={20} className="shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
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
            <ul className="mt-2 flex flex-col divide-y divide-line overflow-hidden rounded-[20px] border border-line/60 bg-surface">
              {archived.map(({ list, totals }) => (
                <li key={list.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40">
                  <Link href={`/cumparaturi/lista/?id=${list.id}`} className="min-w-0 flex-1 py-0.5">
                    <span className="line-clamp-2 text-[15px] font-medium leading-snug text-ink">{list.name}</span>
                    <span className="text-xs text-ink-2 tabular">{formatRon(totals.spent)} cheltuit</span>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => run((ctx) => restoreList(ctx, list.id), "Lista e din nou activă.")}>
                    Pune la loc
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
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
