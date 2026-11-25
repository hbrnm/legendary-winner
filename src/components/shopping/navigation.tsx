import Link from "next/link";

/** Subnavigație pentru secțiunea Cumpărături (Liste și Istoric). */
export function ShoppingNavigation({ active }: { active: "liste" | "istoric" }) {
  return (
    <nav aria-label="Secțiunile cumpărăturilor" className="recipe-navigation">
      <Link href="/cumparaturi/?toate=1" aria-current={active === "liste" ? "page" : undefined}>Liste</Link>
      <Link href="/cumparaturi/istoric/" aria-current={active === "istoric" ? "page" : undefined}>Istoric</Link>
    </nav>
  );
}
