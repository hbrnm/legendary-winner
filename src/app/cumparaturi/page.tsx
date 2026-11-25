"use client";

import { Suspense, useEffect, useRef, useState, type Ref } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AgainIcon, BasketIcon, ChevronDown, ChevronRight, NotebookIcon } from "@/components/ui/icons";
import { AppShell } from "@/components/app/shell";
import { useActiveShoppingList } from "@/components/shopping/active-list-provider";
import { useAction, useData } from "@/components/app/hooks";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, PageHeader, Spinner } from "@/components/ui/misc";
import { ShoppingNavigation } from "@/components/shopping/navigation";
import { listItems, owned, priceIndex, visible } from "@/lib/services/queries";
import { createList, restoreList } from "@/lib/services/shopping";
import { listTotals } from "@/lib/domain/shopping";
import { formatRon } from "@/lib/domain/money";
import { formatShortDate, toISODate } from "@/lib/domain/dates";
import { now } from "@/lib/clock";

function ListsScreen({ captureRef }: { captureRef: Ref<HTMLDivElement> }) {
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
        captureRef={captureRef}
        subtitle={active.length === 1 ? "1 listă activă" : `${active.length} liste active`}
      />
      <ShoppingNavigation active="liste" />

      {active.length === 0 ? (
        <EmptyState
          icon={<BasketIcon size={32} />}
          title="Încă n-ai nicio listă"
          action={<Button onClick={handleCreateList}>Creează o listă</Button>}
        >
          Apasă pe butonul de mai sus pentru a crea o listă nouă sau folosește butonul (+) pentru a copia o listă mai veche.
        </EmptyState>
      ) : (
        <ul aria-label="Liste active" className="app-card divide-y divide-line overflow-hidden">
          {active.map(({ list, totals }) => (
            <li key={list.id}>
              <Link href={`/cumparaturi/lista/?id=${list.id}`} className="group flex min-h-16 items-center gap-3 px-3 py-2.5 hover:bg-surface-2/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" onClick={() => selectList(list.id)}>
                <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-brand">
                  <BasketIcon size={19} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="line-clamp-2 break-words text-[15px] font-semibold leading-snug text-ink group-hover:text-brand">
                      {list.name}
                    </span>
                    {list.is_recurring && (
                      <Badge tone="brand">
                        <AgainIcon size={12} strokeWidth={2} /> se reia
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-2 tabular">
                    {totals.item_count === 0 ? "Încă goală" : `${totals.checked_count} din ${totals.item_count} în coș${totals.projected_total > 0 ? ` · ~${formatRon(totals.projected_total)}` : ""}`}
                    {list.default_retailer_id && ` · ${retailerName.get(list.default_retailer_id) ?? ""}`}
                  </p>
                </div>
                <ChevronRight size={20} className="shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section aria-label="Puse deoparte" className="mt-3 app-card">
          <button type="button" aria-expanded={showArchived} onClick={() => setShowArchived((v) => !v)}
            className="flex min-h-12 w-full items-center gap-2 rounded-[20px] px-4 text-left text-sm font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex-1">Puse deoparte</span>
            <span className="text-xs font-medium tabular text-ink-2">{archived.length}</span>
            <ChevronDown size={16} className={showArchived ? "rotate-180 text-ink-2" : "text-ink-2"} />
          </button>
          {showArchived && (
            <ul className="divide-y divide-line border-t border-line">
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
        </section>
      )}
      <Link href="/cumparaturi/istoric/" className="mt-3 flex min-h-12 items-center gap-2 app-card px-4 text-sm font-medium text-brand hover:bg-surface-2/40">
        <NotebookIcon size={18} />
        <span className="flex-1">Istoricul cumpărăturilor</span>
        <ChevronRight size={16} />
      </Link>
    </>
  );
}

export default function Page() {
  const [captureTarget, setCaptureTarget] = useState<HTMLDivElement | null>(null);

  return (
    <AppShell captureTarget={captureTarget}>
      <Suspense fallback={<Spinner />}>
        <ListsScreen captureRef={setCaptureTarget} />
      </Suspense>
    </AppShell>
  );
}
