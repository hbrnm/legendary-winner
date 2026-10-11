import type { RetailerSeed } from "./seed-types";

/**
 * Lanțurile de magazine din România. Doar numele și tipul: aplicația nu are
 * acces la cataloagele sau prețurile lor (vezi docs/ARCHITECTURE.md, „Surse de date”).
 * Piețele și producătorii se adaugă de fiecare gospodărie.
 */
export const RETAILER_SEEDS: RetailerSeed[] = [
  { id: "lidl", name: "Lidl", kind: "discount" },
  { id: "kaufland", name: "Kaufland", kind: "hipermarket" },
  { id: "carrefour", name: "Carrefour", kind: "hipermarket" },
  { id: "auchan", name: "Auchan", kind: "hipermarket" },
  { id: "mega-image", name: "Mega Image", kind: "supermarket" },
  { id: "penny", name: "Penny", kind: "discount" },
  { id: "profi", name: "Profi", kind: "proximitate" },
  { id: "selgros", name: "Selgros", kind: "cash_carry" },
  { id: "metro", name: "Metro", kind: "cash_carry" },
  { id: "la-doi-pasi", name: "La Doi Pași", kind: "proximitate" },
  { id: "annabella", name: "Annabella", kind: "supermarket" },
  { id: "diana", name: "Diana", kind: "supermarket" },
  { id: "dm", name: "dm drogerie markt", kind: "alta" },
];
