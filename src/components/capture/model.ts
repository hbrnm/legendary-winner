import type { ExpenseCategoryId } from "@/lib/domain/expense-categories";
import type { ManualExpense, PurchaseSource, Retailer, RetailerKind } from "@/lib/domain/types";
export type ExpenseShortcut = "supermarket" | "piata" | "locuinta" | "altele";
export type CapturePlace = { key: string; name: string; retailerId: string | null; source: PurchaseSource };
export function sourceOfRetailer(kind: RetailerKind): PurchaseSource {
  return kind === "piata" || kind === "producator" ? kind : kind === "alta" ? "alta" : "supermarket";
}
export function shortcutCategory(shortcut: ExpenseShortcut): ExpenseCategoryId {
  return shortcut === "supermarket" || shortcut === "piata" ? "alimentatie" : shortcut;
}
export function capturePlaces(retailers: Retailer[], expenses: ManualExpense[]): CapturePlace[] {
  const live = retailers.filter(r => !r.deleted_at);
  const byId = new Map(live.map(r => [r.id, r]));
  const places: CapturePlace[] = [];
  const add = (name: string, retailerId: string | null, source: PurchaseSource) => {
    const normalized = name.trim().toLocaleLowerCase("ro");
    if (!normalized || places.some(p => p.name.toLocaleLowerCase("ro") === normalized)) return;
    places.push({ key: retailerId ?? `loc:${normalized}`, name: name.trim(), retailerId, source });
  };
  for (const e of [...expenses].filter(e => !e.deleted_at).sort((a,b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at))) {
    const retailer = e.retailer_id ? byId.get(e.retailer_id) : undefined;
    if (retailer) add(retailer.name, retailer.id, sourceOfRetailer(retailer.kind));
    else if (e.place_name) add(e.place_name, null, e.source ?? "alta");
  }
  for (const r of live) add(r.name, r.id, sourceOfRetailer(r.kind));
  return places;
}
