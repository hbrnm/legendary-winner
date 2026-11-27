// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { buildCatalog } from "@/data/catalog";
import { RecipeNutritionCard } from "./recipe-nutrition";

const { lookup, put, journal } = vi.hoisted(() => ({ lookup: vi.fn(), put: vi.fn(), journal: vi.fn() }));
vi.mock("@/components/app/app-provider", () => ({ useApp: () => ({ mode: "cloud", ctx: { userId: "personal" } }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ callLookupNutrition: lookup }));
vi.mock("@/lib/db/calorie-database", () => ({ calorieDatabase: () => ({ labels: { put } }) }));
vi.mock("./journal", () => ({ AddRecipeCalories: (props: unknown) => { journal(props); return null; } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("arată sugestia, preia valorile numai după confirmare și salvează corecția cu sursa", async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
  HTMLDialogElement.prototype.close ??= function () { this.open = false; };
  const code = "5949084024838";
  const catalog = buildCatalog();
  const product = { ...catalog.products[0], ean: code, name: "Ovăz din cămară", household_id: "family" };
  lookup.mockResolvedValue(Response.json({
    product: { code, name: "Fulgi de ovăz", brand: "Auchan", quantity: "500 g", nutrition: { basis: "g", values: { kcal: 324, protein_g: 10, carbs_g: 65.2, fat_g: 1.3 } } },
  }));
  render(<RecipeNutritionCard
    recipe={catalog.recipes[0]}
    servings={1}
    labels={[]}
    products={new Map([[product.id, product]])}
    ingredients={[{ ...catalog.recipe_ingredients[0], product_id: product.id, quantity: 25, unit: "g", optional: false, note: null }]}
  />);
  fireEvent.click(screen.getByText("Contribuția estimată pe ingredient"));
  fireEvent.click(screen.getByRole("button", { name: "Valori de pe etichetă" }));
  fireEvent.click(screen.getByText("Caută după codul de bare"));
  fireEvent.click(screen.getByRole("button", { name: "Caută produsul" }));
  const confirm = await screen.findByRole("button", { name: "Confirmă produsul și preia valorile" });
  expect(lookup).toHaveBeenCalledWith(code);
  expect((screen.getByLabelText("Energie (kcal)") as HTMLInputElement).value).toBe("");
  expect(put).not.toHaveBeenCalled();

  fireEvent.click(confirm);
  const energy = screen.getByLabelText("Energie (kcal)") as HTMLInputElement;
  expect(energy.value).toBe("324");
  fireEvent.change(energy, { target: { value: "325" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează valorile" }));
  await waitFor(() => expect(put).toHaveBeenCalledWith(expect.objectContaining({
    open_food_facts_code: code, basis: "g", values: { kcal: 325, protein_g: 10, carbs_g: 65.2, fat_g: 1.3 },
  })));
});

it("acceptă zecimale cu virgulă pentru produse din catalog și curăță sursa Open Food Facts la editare manuală", async () => {
  HTMLDialogElement.prototype.showModal ??= function () { this.open = true; };
  HTMLDialogElement.prototype.close ??= function () { this.open = false; };
  const catalog = buildCatalog();
  const product = { ...catalog.products[0], household_id: null };
  render(<RecipeNutritionCard
    recipe={catalog.recipes[0]}
    servings={1}
    labels={[{
      user_id: "personal",
      product_id: product.id,
      basis: "g",
      preparation: "as_sold",
      values: { kcal: 324, protein_g: 10, carbs_g: 65.2, fat_g: 1.3 },
      open_food_facts_code: "5949084024838",
    }]}
    products={new Map([[product.id, product]])}
    ingredients={[{ ...catalog.recipe_ingredients[0], product_id: product.id, quantity: 25, unit: "g", optional: false, note: null }]}
  />);
  fireEvent.click(screen.getByText("Contribuția estimată pe ingredient"));
  fireEvent.click(screen.getByRole("button", { name: "Editează valorile" }));
  fireEvent.change(screen.getByLabelText("Carbohidrați (g)"), { target: { value: "66,5" } });
  fireEvent.click(screen.getByRole("button", { name: "Salvează valorile" }));
  await waitFor(() => expect(put).toHaveBeenCalledWith(expect.objectContaining({
    product_id: product.id,
    open_food_facts_code: undefined,
    values: { kcal: 324, protein_g: 10, carbs_g: 66.5, fat_g: 1.3 },
  })));
});

it("recalculează cantitatea temporară pentru porțiile afișate și actualizează valorile trimise în jurnal", () => {
  const catalog = buildCatalog();
  const product = catalog.products[0];
  const ingredient = { ...catalog.recipe_ingredients[0], product_id: product.id, quantity: null, unit: null, optional: false, note: null };
  render(<RecipeNutritionCard
    recipe={{ ...catalog.recipes[0], nutrition: null, servings: 1 }}
    servings={2}
    products={new Map([[product.id, product]])}
    labels={[{ user_id: "personal", product_id: product.id, basis: "g", preparation: "as_sold", values: { kcal: 200, protein_g: 10, carbs_g: 20, fat_g: 5 } }]}
    ingredients={[ingredient]}
  />);
  expect(screen.getByText("Calcul parțial · 1 ingredient necalculat")).toBeTruthy();
  fireEvent.click(screen.getByText("Contribuția estimată pe ingredient"));
  fireEvent.click(screen.getByRole("button", { name: "Introdu cantitatea" }));
  fireEvent.change(screen.getByLabelText("Cantitate"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "Recalculează" }));
  expect(screen.getByText("În jurnal · 100 kcal per porție")).toBeTruthy();
  expect(journal).toHaveBeenLastCalledWith({ recipe: expect.objectContaining({ incomplete: false, per_serving: { kcal: 100, protein_g: 5, carbs_g: 10, fat_g: 2.5 } }) });
  fireEvent.click(screen.getByRole("button", { name: "Revino la cantitatea din rețetă" }));
  expect(screen.getByText("Calcul parțial · 1 ingredient necalculat")).toBeTruthy();
});
