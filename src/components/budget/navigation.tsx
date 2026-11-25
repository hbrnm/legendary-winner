import Link from "next/link";

/** Subnavigație comună pentru secțiunea Buget (Rezumat, Tranzacții, Prețuri). */
export function BudgetNavigation({ active, transactionsHref = "/buget/tranzactii/", summaryHref = "/buget/" }: { active: "rezumat" | "tranzactii" | "preturi"; transactionsHref?: string; summaryHref?: string }) {
  return (
    <nav aria-label="Secțiunile bugetului" className="recipe-navigation">
      <Link href={summaryHref} aria-current={active === "rezumat" ? "page" : undefined}>Rezumat</Link>
      <Link href={transactionsHref} aria-current={active === "tranzactii" ? "page" : undefined}>Tranzacții</Link>
      <Link href="/buget/preturi/" aria-current={active === "preturi" ? "page" : undefined}>Prețuri</Link>
    </nav>
  );
}
