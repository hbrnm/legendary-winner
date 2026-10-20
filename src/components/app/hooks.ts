"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useCallback, useState } from "react";
import { useApp } from "./app-provider";
import type { AppCtx } from "@/lib/services/context";
import { UserError } from "@/lib/services/context";
import { useToast } from "@/components/ui/toast";

/** Citire reactivă din baza locală: se reactualizează la orice modificare (inclusiv din sincronizare). */
export function useData<T>(query: (ctx: AppCtx) => Promise<T>, deps: unknown[] = []): T | undefined {
  const { ctx } = useApp();
  return useLiveQuery(async () => (ctx ? query(ctx) : undefined), [ctx, ...deps]);
}

/**
 * Rulează o acțiune și arată eroarea pe înțelesul utilizatorului. Erorile
 * neașteptate nu își expun detaliile tehnice.
 */
export function useAction() {
  const { ctx } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async <T,>(fn: (ctx: AppCtx) => Promise<T>, success?: string | ((r: T) => string)): Promise<T | undefined> => {
      if (!ctx) return undefined;
      setBusy(true);
      try {
        const r = await fn(ctx);
        if (success) toast(typeof success === "function" ? success(r) : success);
        return r;
      } catch (e) {
        if (e instanceof UserError) toast(e.message, { tone: "error" });
        else {
          console.error(e);
          toast("Ceva n-a mers. Încearcă din nou; datele tale sunt în siguranță.", { tone: "error" });
        }
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [ctx, toast],
  );
  return { run, busy };
}
