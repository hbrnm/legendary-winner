/** Categoriile bugetului familiei, separate de raioanele produselor. */
export const EXPENSE_CATEGORIES = [
  { id: "alimentatie", name: "Alimentație" },
  { id: "educatie", name: "Școala și educația copiilor" },
  { id: "haine", name: "Haine și încălțăminte" },
  { id: "transport", name: "Transport și mașină" },
  { id: "locuinta", name: "Locuință și utilități" },
  { id: "sanatate", name: "Sănătate" },
  { id: "ingrijire", name: "Îngrijire personală și curățenie" },
  { id: "activitati", name: "Activități, sport și divertisment" },
  { id: "vacante", name: "Vacanțe" },
  { id: "abonamente", name: "Abonamente și servicii" },
  { id: "cadouri", name: "Cadouri și evenimente" },
  { id: "altele", name: "Alte cheltuieli" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];
export const EXPENSE_CATEGORY_IDS = EXPENSE_CATEGORIES.map((c) => c.id) as [ExpenseCategoryId, ...ExpenseCategoryId[]];
export function expenseCategoryName(id: string): string {
  return EXPENSE_CATEGORIES.find((c) => c.id === id)?.name ?? "Alte cheltuieli";
}
