import Link from "next/link";

/** Recipe catalogue and meal plan share one destination in the app shell. */
export function RecipeNavigation({ active }: { active: "retete" | "plan" }) {
  return (
    <nav aria-label="Rețete și plan" className="recipe-navigation">
      <Link href="/retete/" aria-current={active === "retete" ? "page" : undefined}>Colecție</Link>
      <Link href="/plan/" aria-current={active === "plan" ? "page" : undefined}>Plan</Link>
    </nav>
  );
}
