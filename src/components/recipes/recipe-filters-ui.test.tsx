// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { recipe } from "@/test/factories";
import RecipesPage from "@/app/retete/page";

vi.mock("@/components/app/shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/components/recipes/recipe-photo", () => ({ RecipeImage: () => null }));
vi.mock("@/components/app/hooks", () => ({ useData: () => {
  const recipes = [
    recipe({ id: "soup", name: "Supă rapidă", categories: ["pranz", "supe_ciorbe"], prep_minutes: 10, cook_minutes: 10 }),
    recipe({ id: "main", name: "Pilaf", categories: ["cina", "vegetariene"], prep_minutes: 15, cook_minutes: 30 }),
    recipe({ id: "prep", name: "Tocană", categories: ["pranz", "carne", "meal_prep"], prep_minutes: 20, cook_minutes: 60 }),
  ];
  return { recipes, searchText: new Map(recipes.map((r) => [r.id, r.name])), favorites: new Set(["main"]), costs: new Map(), cook: [{ recipe: recipes[1], missing: [] }], pantryCount: 1 };
} }));

afterEach(cleanup);

describe("recipe collection controls", () => {
  it("shows the seven meal categories and routes collection and plan", () => {
    render(<RecipesPage />);
    const strip = screen.getByLabelText("Categoria mesei");
    expect([...strip.querySelectorAll("button")].map((b) => b.textContent)).toEqual(["Toate", "Mic dejun", "Supe & Ciorbe", "Fel principal", "Salate & Garnituri", "Deserturi", "Gustări"]);
    expect(screen.getByRole("link", { name: "Colecție" }).getAttribute("href")).toMatch(/^\/retete\/?$/);
    expect(screen.getByRole("link", { name: "Plan" }).getAttribute("href")).toMatch(/^\/plan\/?$/);
    fireEvent.click(screen.getByRole("button", { name: "Fel principal" }));
    expect(screen.queryByRole("link", { name: /Supă rapidă/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("2 rețete");
  });

  it("combines pantry with search and category, and replaces the active time option", () => {
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
