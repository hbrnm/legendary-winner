// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCatalog } from "@/data/catalog";
import { buildCalorieSearchCatalog } from "@/data/calorie-search";
import type { CalorieEntry, CaloriePreferences } from "@/lib/domain/calories";
import { HomeCalories } from "./journal";

const state = vi.hoisted(() => ({
  active: null as CaloriePreferences | null,
  mode: "cloud" as "demo" | "cloud",
  hasDb: false,
  entries: [] as CalorieEntry[],
  lookup: vi.fn(),
  putPref: vi.fn(async (pref: CaloriePreferences) => { state.active = pref; }),
  addEntry: vi.fn(async (entry: CalorieEntry) => { state.entries.push(entry); }),
  updateEntry: vi.fn(async (id: string, patch: Partial<CalorieEntry>) => {
    state.entries = state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
    return 1;
  }),
  deleteEntry: vi.fn(async (id: string) => { state.entries = state.entries.filter((e) => e.id !== id); }),
}));

const sampleCatalog = buildCatalog();
const searchCatalog = buildCalorieSearchCatalog({
  products: sampleCatalog.products,
  aliases: sampleCatalog.product_aliases,
  categories: sampleCatalog.product_categories,
  recipes: sampleCatalog.recipes,
  ingredients: sampleCatalog.recipe_ingredients,
  labels: [],
});

vi.mock("@/components/app/app-provider", () => ({
  useApp: () => ({
    mode: state.mode,
    ctx: state.hasDb ? { userId: "u1", householdId: "h1", db: {} } : { userId: "u1" },
  }),
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/lib/clock", () => ({ now: () => new Date("2026-03-08T09:00:00+02:00") }));
vi.mock("@/lib/supabase/client", () => ({ callLookupNutrition: state.lookup }));
vi.mock("@/components/app/hooks", () => ({
  useData: () => (state.hasDb ? searchCatalog : undefined),
}));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));
vi.mock("@/lib/db/calorie-database", () => ({
  calorieDatabase: () => ({
    preferences: {
      get: () => state.active ?? undefined,
      put: state.putPref,
    },
    entries: {
      where: () => ({
        equals: ([, date]: [string, string]) => ({
          toArray: () => state.entries.filter((e) => e.date === date),
        }),
        between: () => ({
          toArray: () => state.entries,
        }),
      }),
      add: state.addEntry,
      update: state.updateEntry,
      delete: state.deleteEntry,
    },
  }),
}));

beforeEach(() => {
  HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
  HTMLDialogElement.prototype.close ??= function () { this.open = false; };
  state.active = null;
  state.mode = "cloud";
  state.hasDb = false;
  state.entries = [];
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("jurnalul de calorii de pe Acasă", () => {
  it("activează jurnalul, adaugă intrare manuală și afișează singularul pentru 1 porție și macronutrienții", async () => {
    const { rerender } = render(<HomeCalories today="2026-03-08" />);
    fireEvent.click(screen.getByRole("button", { name: "Jurnal calorii" }));
    fireEvent.click(screen.getByRole("button", { name: "Activează jurnalul" }));
    await waitFor(() => expect(state.putPref).toHaveBeenCalledWith({ user_id: "u1" }));

    state.entries = [
      {
        id: "r1",
        user_id: "u1",
        date: "2026-03-08",
        meal: "mic_dejun",
        recipe: { name: "Omletă", per_serving: { kcal: 300, protein_g: 20, carbs_g: 2, fat_g: 22 }, source: "declared", incomplete: false },
        servings: 1,
        manual_kcal: null,
      },
    ];
    rerender(<HomeCalories today="2026-03-08" />);
    expect(screen.getByText(/1 porție · 300 kcal/)).toBeTruthy();
    expect(screen.getByText("P 20 g · C 2 g · G 22 g")).toBeTruthy();
    expect(screen.getByText("Proteine 20 g · Carbohidrați 2 g · Grăsimi 22 g")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adaugă mâncare" }));
    fireEvent.click(screen.getByRole("radio", { name: "Scrie manual" }));
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-03-09" } });
    fireEvent.change(screen.getByLabelText("Calorii (kcal)"), { target: { value: "120" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvează intrarea" }).closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("Verifică data");
    expect(state.addEntry).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-03-08" } });
    fireEvent.change(screen.getByLabelText("Denumire (opțional)"), { target: { value: "Cafea" } });
    fireEvent.change(screen.getByLabelText("Calorii (kcal)"), { target: { value: "120,5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvează intrarea" }).closest("form")!);
    await waitFor(() => expect(state.addEntry).toHaveBeenCalledWith(expect.objectContaining({
      manual_kcal: 120.5,
      label: "Cafea",
      meal: "mic_dejun",
      date: "2026-03-08",
    })));
  });

  it("caută un produs din catalog după nume, un produs Open Food Facts după cod de bare și salvează obiectivul zilnic", async () => {
    state.active = { user_id: "u1" };
    state.hasDb = true;
    state.lookup.mockResolvedValue(Response.json({
      product: {
        code: "5949084024838",
        name: "Fulgi de ovăz",
        brand: "Auchan",
        quantity: "500 g",
        nutrition: { basis: "g", values: { kcal: 324, protein_g: 10, carbs_g: 65.2, fat_g: 1.3 } },
      },
    }));

    const { rerender } = render(<HomeCalories today="2026-03-08" />);
    fireEvent.click(screen.getByRole("button", { name: /Calorii azi/ }));

    fireEvent.click(screen.getByRole("button", { name: "Setează obiectiv" }));
    fireEvent.change(screen.getByLabelText("Calorii (kcal / zi)"), { target: { value: "2000" } });
    fireEvent.change(screen.getByLabelText("Proteine (g / zi, opțional)"), { target: { value: "120" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvează obiectivul" }).closest("form")!);
    await waitFor(() => expect(state.putPref).toHaveBeenCalledWith({
      user_id: "u1",
      goal: { kcal: 2000, protein_g: 120, carbs_g: null, fat_g: null },
    }));

    fireEvent.click(screen.getByRole("button", { name: "Adaugă mâncare" }));
    fireEvent.change(screen.getByLabelText("Caută un aliment sau o rețetă"), { target: { value: "oua" } });
    fireEvent.click(screen.getByRole("button", { name: /^Ouă de găină/ }));
    fireEvent.click(screen.getByRole("button", { name: /^2$/ }));
    fireEvent.change(screen.getByLabelText("Masă"), { target: { value: "pranz" } });
    expect(screen.getByText("140 kcal")).toBeTruthy();
    fireEvent.submit(screen.getByRole("button", { name: "Salvează intrarea" }).closest("form")!);
    await waitFor(() => expect(state.addEntry).toHaveBeenCalledWith(expect.objectContaining({
      meal: "pranz",
      food: expect.objectContaining({ name: "Ouă de găină", quantity: 2, unit: "buc" }),
    })));

    rerender(<HomeCalories today="2026-03-08" />);
    expect(screen.getByText(/Rămase: 1\.860 kcal/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adaugă mâncare" }));
    expect(screen.getByText("Adăugate recent")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Scanează codul de bare" }));
    fireEvent.change(screen.getByLabelText("Cod de bare"), { target: { value: "5949084024838" } });
    fireEvent.click(screen.getByRole("button", { name: "Caută produsul" }));
    const pick = await screen.findByRole("button", { name: "Alege produsul" });
    fireEvent.click(pick);
    fireEvent.change(screen.getByLabelText("Cantitate"), { target: { value: "50" } });
    expect(screen.getByText("162 kcal")).toBeTruthy();
    fireEvent.submit(screen.getByRole("button", { name: "Salvează intrarea" }).closest("form")!);
    await waitFor(() => expect(state.addEntry).toHaveBeenLastCalledWith(expect.objectContaining({
      food: expect.objectContaining({
        name: "Fulgi de ovăz · Auchan",
        quantity: 50,
        unit: "g",
        open_food_facts_code: "5949084024838",
      }),
    })));
  });
});
