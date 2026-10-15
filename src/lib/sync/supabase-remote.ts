import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import type { TableName } from "@/lib/db/database";
import { RemoteRejected, RemoteUnavailable, type PullFrom, type RemoteRow, type RemoteStore } from "./remote";
import type { RemoteFiles } from "./files";

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

  async pull(table: TableName, from: PullFrom | null, limit: number): Promise<RemoteRow[]> {
    const data = await this.run(() => {
      let q = this.client.from(table).select("*").order("updated_at", { ascending: true }).order("id").limit(limit);
      if (from?.id !== undefined) q = q.or(`updated_at.gt."${from.updated_at}",and(updated_at.eq."${from.updated_at}",id.gt."${from.id}")`);
      else if (from) q = q.gte("updated_at", from.updated_at);
      return q;
    });
    return (data ?? []) as RemoteRow[];
  }

  async serverNow(): Promise<string> {
    return this.run(() => this.client.rpc("server_now")) as Promise<string>;
  }

  subscribe(householdId: string, onChange: () => void): () => void {
    let channel = this.client.channel(`gospodarie:${householdId}`);
    for (const table of REALTIME_TABLES) {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, () => onChange());
    }
    channel.subscribe();
    // Tabelele din OPTIONAL_TABLES pot lipsi pe server: canal separat, ca un
    // abonament refuzat să nu oprească notificările celorlalte tabele.
    const photos = this.client
      .channel(`gospodarie-fotografii:${householdId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "recipe_photos", filter: `household_id=eq.${householdId}` }, () => onChange());
    photos.subscribe();
    return () => {
      void this.client.removeChannel(channel);
      void this.client.removeChannel(photos);
    };
  }
}

const BUCKET = "recipe-photos";

/**
 * Refuz definitiv: drepturi (RLS), fișier prea mare, tip nepermis, cerere
 * invalidă. Un bucket lipsă (404) sau o sesiune expirată se reîncearcă: nu
 * pierdem fotografia din cauza unei configurări sau a unui token vechi.
 */
export function classifyStorage(error: { message: string; status?: number; statusCode?: string }): Error {
  const fromBody = Number(error.statusCode);
  const code = Number.isInteger(fromBody) && fromBody > 0 ? fromBody : Number(error.status);
  if ([400, 403, 413, 415, 422].includes(code) && !/jwt|token|exp|claim/i.test(error.message)) return new RemoteRejected(error.message, String(code));
  return new RemoteUnavailable(error.message);
}

export class SupabaseFiles implements RemoteFiles {
  constructor(private client: SupabaseClient) {}

  private async run<T>(fn: () => Promise<{ data: T; error: unknown }>): Promise<T> {
    let res;
    try {
      res = await fn();
    } catch (e) {
      throw new RemoteUnavailable(e instanceof Error ? e.message : "Fără conexiune");
    }
    if (res.error) throw classifyStorage(res.error as { message: string; status?: number; statusCode?: string });
    return res.data;
  }

  async upload(path: string, data: ArrayBuffer, contentType: string): Promise<void> {
    await this.run(() => this.client.storage.from(BUCKET).upload(path, data, { contentType, upsert: true, cacheControl: "31536000" }));
  }

  async download(path: string): Promise<Blob> {
    return this.run(() => this.client.storage.from(BUCKET).download(path)) as Promise<Blob>;
  }

  async remove(paths: string[]): Promise<void> {
    if (paths.length > 0) await this.run(() => this.client.storage.from(BUCKET).remove(paths));
  }
}
