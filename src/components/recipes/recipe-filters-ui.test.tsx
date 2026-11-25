// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { recipe } from "@/test/factories";
import RecipesPage from "@/app/retete/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/app/shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/recipes/recipe-photo", () => ({ RecipeImage: () => null }));
vi.mock("@/components/app/hooks", () => ({ useAction: () => ({ run: vi.fn(), busy: false }), useData: () => {
  const recipes = [
    recipe({ id: "soup", name: "Supă rapidă", categories: ["pranz", "supe_ciorbe"], prep_minutes: 10, cook_minutes: 10 }),
    recipe({ id: "main", name: "Pilaf", categories: ["pranz", "cina", "vegetariene"], prep_minutes: 15, cook_minutes: 30 }),
    recipe({ id: "prep", name: "Tocană", categories: ["pranz", "carne", "meal_prep"], prep_minutes: 20, cook_minutes: 60 }),
  ];
  return { recipes, searchText: new Map(recipes.map((r) => [r.id, r.name])), favorites: new Set(["main"]), costs: new Map(), ready: new Set(["main"]), cook: [{ recipe: recipes[1], missing: [] }], pantryCount: 1 };
} }));

afterEach(cleanup);

describe("recipe collection controls", () => {
  it("starts with collapsed categories and offers the full collection", () => {
    render(<RecipesPage />);
    expect(screen.getByRole("link", { name: "Colecție" }).getAttribute("href")).toMatch(/^\/retete\/?$/);
    expect(screen.getByRole("link", { name: "Plan" }).getAttribute("href")).toMatch(/^\/plan\/?$/);
    const mainCategory = screen.getByText("Prânz").closest("details");
    expect(mainCategory?.querySelector("summary")?.textContent).toBe("Prânz3 rețete");
    expect(mainCategory?.hasAttribute("open")).toBe(false);
    expect(mainCategory?.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("Cină").closest("details")?.querySelectorAll("li")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Toate rețetele" }));
    expect(screen.queryByText("Prânz")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Pe categorii" }));
    expect(screen.getByText("Cină")).toBeTruthy();
  });

  it("combines pantry with search and replaces the active time option", () => {
    render(<RecipesPage />);
    fireEvent.click(screen.getByRole("button", { name: "Filtre" }));
    fireEvent.click(screen.getByRole("button", { name: "Ce pot găti" }));
    expect(screen.getByRole("status").textContent).toBe("1 rețetă");
    fireEvent.change(screen.getByRole("textbox", { name: "Caută rețete" }), { target: { value: "Supă" } });
    expect(screen.getByRole("status").textContent).toBe("0 rețete");
    fireEvent.change(screen.getByRole("textbox", { name: "Caută rețete" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Sub 30 min" }));
    expect(screen.getByRole("status").textContent).toBe("0 rețete");
    fireEvent.click(screen.getByRole("button", { name: "Sub 60 min" }));
    expect(screen.getByRole("button", { name: "Sub 30 min" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByRole("button", { name: "Sub 60 min" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("1 rețetă");
    expect(screen.getByRole("button", { name: "Filtre (2)" })).toBeTruthy();
  });
});
