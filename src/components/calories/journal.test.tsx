// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CalorieEntry } from "@/lib/domain/calories";
import { HomeCalories } from "./journal";

const state = vi.hoisted(() => ({
  active: false,
  entries: [] as CalorieEntry[],
  putPref: vi.fn(async () => { state.active = true; }),
  addEntry: vi.fn(async (entry: CalorieEntry) => { state.entries.push(entry); }),
  updateEntry: vi.fn(async () => 1),
  deleteEntry: vi.fn(async (id: string) => { state.entries = state.entries.filter((e) => e.id !== id); }),
}));

vi.mock("@/components/app/app-provider", () => ({ useApp: () => ({ ctx: { userId: "u1" } }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => vi.fn() }));
vi.mock("@/lib/clock", () => ({ now: () => new Date("2026-03-08T09:00:00+02:00") }));
vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: (fn: () => unknown) => fn(),
}));
vi.mock("@/lib/db/calorie-database", () => ({
  calorieDatabase: () => ({
    preferences: {
      get: () => (state.active ? { user_id: "u1" } : undefined),
      put: state.putPref,
    },
    entries: {
      where: () => ({
        equals: ([, date]: [string, string]) => ({
          toArray: () => state.entries.filter((e) => e.date === date),
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
  state.active = false;
  state.entries = [];
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("jurnalul de calorii de pe Acasă", () => {
  it("activează jurnalul, adaugă intrare manuală și afișează singularul pentru 1 porție", async () => {
    const { rerender } = render(<HomeCalories today="2026-03-08" />);
    fireEvent.click(screen.getByRole("button", { name: "Jurnal calorii" }));
    fireEvent.click(screen.getByRole("button", { name: "Activează jurnalul" }));
    await waitFor(() => expect(state.putPref).toHaveBeenCalledWith({ user_id: "u1" }));

    state.entries = [
      {
        id: "r1",
        user_id: "u1",
        date: "2026-03-08",
        recipe: { name: "Omletă", per_serving: { kcal: 300, protein_g: 20, carbs_g: 2, fat_g: 22 }, source: "declared", incomplete: false },
        servings: 1,
        manual_kcal: null,
      },
    ];
    rerender(<HomeCalories today="2026-03-08" />);
    expect(screen.getByText(/1 porție · 300 kcal/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Adaugă calorii" }));
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-03-09" } });
    fireEvent.change(screen.getByLabelText("Calorii (kcal)"), { target: { value: "120" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvează intrarea" }).closest("form")!);
    expect(screen.getByRole("alert").textContent).toContain("Verifică data");
    expect(state.addEntry).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-03-08" } });
    fireEvent.change(screen.getByLabelText("Calorii (kcal)"), { target: { value: "120,5" } });
    fireEvent.submit(screen.getByRole("button", { name: "Salvează intrarea" }).closest("form")!);
    await waitFor(() => expect(state.addEntry).toHaveBeenCalledWith(expect.objectContaining({ manual_kcal: 120.5, date: "2026-03-08" })));
  });
});
