"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useActiveShoppingList } from "./active-list-provider";

export interface ListSwitcherItem {
  id: string;
  name: string;
}

export interface ListSwitcherProps {
  currentListId: string;
  lists: ListSwitcherItem[];
  className?: string;
}

export function ListSwitcher({ currentListId, lists, className = "" }: ListSwitcherProps) {
  const router = useRouter();
  const { selectList } = useActiveShoppingList();
  const [open, setOpen] = useState(false);

  function handleSelect(id: string) {
    setOpen(false);
    selectList(id);
    router.push(`/cumparaturi/lista/?id=${id}`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Comută lista de cumpărături"
        className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-xs font-semibold text-ink transition-colors hover:bg-surface-container-high focus-visible:outline-2 focus-visible:outline-brand ${className}`}
      >
        <span>Comută lista</span>
        <ChevronDown size={14} className="text-ink-2" />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Comută lista de cumpărături">
        <div className="flex flex-col gap-2">
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => handleSelect(l.id)}
              className={`flex min-h-12 items-center justify-between rounded-xl px-4 text-left text-sm font-medium transition-colors ${
                l.id === currentListId ? "bg-brand text-brand-ink" : "bg-surface-2 text-ink hover:bg-surface-container-high"
              }`}
            >
              <span>{l.name}</span>
              {l.id === currentListId && <span className="text-xs">activă</span>}
            </button>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-line pt-3">
            <Button
              block
              variant="secondary"
              onClick={() => {
                setOpen(false);
                router.push("/cumparaturi/?nou=1");
              }}
            >
              + Listă nouă
            </Button>
            <Button
              block
              variant="ghost"
              onClick={() => {
                setOpen(false);
                router.push("/cumparaturi/?toate=1");
              }}
            >
              Vezi toate listele
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
