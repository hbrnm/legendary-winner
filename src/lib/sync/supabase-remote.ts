import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { TableName } from "@/lib/db/database";
import { RemoteRejected, RemoteUnavailable, type RemoteRow, type RemoteStore } from "./remote";

const REALTIME_TABLES: TableName[] = [
  "shopping_lists",
  "shopping_list_items",
  "shopping_transactions",
  "shopping_transaction_items",
  "product_prices",
  "meal_plan_items",
  "pantry_items",
  "budgets",
  "favorite_recipes",
  "household_settings",
  "products",
  "recipes",
];

/** Erorile Postgres/PostgREST care înseamnă „nu se va accepta niciodată”. */
function classify(error: PostgrestError | { message: string; code?: string; status?: number }): Error {
  const code = error.code ?? "";
  const status = "status" in error ? error.status : undefined;
  if (/^(23|22|42|P0)/.test(code) || code === "PGRST204" || code === "PGRST116") return new RemoteRejected(error.message, code);
  if (status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) return new RemoteRejected(error.message, code);
  return new RemoteUnavailable(error.message);
}

export class SupabaseRemote implements RemoteStore {
  constructor(private client: SupabaseClient) {}

  private async run<T>(fn: () => PromiseLike<{ data: T; error: PostgrestError | null; status?: number }>): Promise<T> {
    let res;
    try {
      res = await fn();
    } catch (e) {
      throw new RemoteUnavailable(e instanceof Error ? e.message : "Fără conexiune");
    }
    if (res.error) throw classify({ ...res.error, status: res.status });
    return res.data;
  }

  async upsert(table: TableName, row: Record<string, unknown>): Promise<void> {
    await this.run(() => this.client.from(table).upsert(row, { onConflict: "id" }));
  }

  async update(table: TableName, id: string, patch: Record<string, unknown>): Promise<boolean> {
    const data = await this.run(() => this.client.from(table).update(patch).eq("id", id).select("id"));
    return Array.isArray(data) && data.length > 0;
  }

  async fetchRow(table: TableName, id: string): Promise<RemoteRow | null> {
    const data = await this.run(() => this.client.from(table).select("*").eq("id", id).maybeSingle());
    return (data as RemoteRow | null) ?? null;
  }

  async pull(table: TableName, since: string | null, limit: number): Promise<RemoteRow[]> {
    const data = await this.run(() => {
      let q = this.client.from(table).select("*").order("updated_at", { ascending: true }).order("id").limit(limit);
      if (since) q = q.gte("updated_at", since);
      return q;
    });
    return (data ?? []) as RemoteRow[];
  }

  subscribe(householdId: string, onChange: () => void): () => void {
    let channel = this.client.channel(`gospodarie:${householdId}`);
    for (const table of REALTIME_TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, () => onChange());
    }
    channel.subscribe();
    return () => {
      void this.client.removeChannel(channel);
    };
  }
}
