import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCatalog } from "./catalog";
import { CATEGORY_SEEDS } from "./categories";
import { PRODUCT_SEEDS } from "./products";
import { RECIPE_SEEDS } from "./recipes";
import { NUTRITION_SEEDS } from "./nutrition";
import { USOARE_MIC_DEJUN_GUSTARI } from "./recipes/usoare-mic-dejun-gustari";
import { USOARE_SUPE_LEGUME } from "./recipes/usoare-supe-legume";
import { USOARE_CARNE_PESTE } from "./recipes/usoare-carne-peste";
import { USOARE_PASTE_DESERTURI } from "./recipes/usoare-paste-deserturi";
import { isUnitCode } from "@/lib/domain/units";
import { normalize } from "@/lib/domain/search";
import { seedSql } from "../../scripts/generate-seed-sql";

const ID = /^[a-z0-9][a-z0-9-]{0,79}$/;
const ALLERGENS = new Set(["gluten", "crustacee", "oua", "peste", "arahide", "soia", "lapte", "fructe_coaja", "telina", "mustar", "susan", "sulfiti", "lupin", "moluste"]);

describe("catalogul de produse", () => {
  it("are cel puțin 300 de produse și 15 categorii", () => {
    expect(PRODUCT_SEEDS.length).toBeGreaterThanOrEqual(300);
    expect(CATEGORY_SEEDS.length).toBeGreaterThanOrEqual(15);
  });

  it("are id-uri valide și unice, fără denumiri duplicate", () => {
    const ids = PRODUCT_SEEDS.map((p) => p.id);
    expect(ids.filter((id) => !ID.test(id))).toEqual([]);
    expect(new Set(ids).size).toBe(ids.length);
    const names = PRODUCT_SEEDS.map((p) => normalize(p.name));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it("folosește doar categorii, unități, luni și alergeni valizi", () => {
    const cats = new Set(CATEGORY_SEEDS.map((c) => c.id));
    for (const p of PRODUCT_SEEDS) {
      expect(cats.has(p.category), p.id).toBe(true);
      expect(isUnitCode(p.unit), p.id).toBe(true);
      for (const m of p.season ?? []) expect(m >= 1 && m <= 12, p.id).toBe(true);
      for (const a of p.allergens ?? []) expect(ALLERGENS.has(a), `${p.id}: ${a}`).toBe(true);
    }
  });

  it("acoperă fiecare categorie și include produsele tradiționale cerute", () => {
    for (const c of CATEGORY_SEEDS) expect(PRODUCT_SEEDS.some((p) => p.category === c.id), c.id).toBe(true);
    for (const id of ["telemea-vaca", "branza-burduf", "urda", "cas", "branza-vaci", "smantana", "iaurt-natural", "lapte-integral", "oua", "miere", "zacusca", "bulion", "magiun", "slanina"]) {
      expect(PRODUCT_SEEDS.some((p) => p.id === id), id).toBe(true);
    }
  });

  it("are produse de sezon și produse de piață", () => {
    expect(PRODUCT_SEEDS.filter((p) => p.season?.length).length).toBeGreaterThan(30);
    expect(PRODUCT_SEEDS.filter((p) => p.market).length).toBeGreaterThan(40);
  });
});

describe("catalogul de rețete", () => {
  const products = new Set(PRODUCT_SEEDS.map((p) => p.id));

  it("are cel puțin 185 de rețete, cu id-uri și denumiri unice", () => {
    expect(RECIPE_SEEDS.length).toBeGreaterThanOrEqual(185);
    const names = RECIPE_SEEDS.map((r) => normalize(r.name));
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
    const ids = RECIPE_SEEDS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !ID.test(id))).toEqual([]);
  });

  it("leagă fiecare ingredient de un produs din catalog", () => {
    const missing = RECIPE_SEEDS.flatMap((r) => r.ingredients.filter((i) => !products.has(i.p)).map((i) => `${r.id}: ${i.p}`));
    expect(missing).toEqual([]);
  });

  it("are rețete complete: porții, timpi, ingrediente, pași, unități valide", () => {
    for (const r of RECIPE_SEEDS) {
      expect(r.servings, r.id).toBeGreaterThan(0);
      expect(r.prep + r.cook, r.id).toBeGreaterThan(0);
      expect(r.ingredients.length, r.id).toBeGreaterThanOrEqual(2);
      expect(r.steps.length, r.id).toBeGreaterThanOrEqual(3);
      expect(r.categories.length, r.id).toBeGreaterThan(0);
      expect(r.description.length, r.id).toBeGreaterThan(10);
      for (const i of r.ingredients) {
        if (i.q == null) expect(i.u, `${r.id}/${i.p}`).toBeNull();
        else {
          expect(i.q, `${r.id}/${i.p}`).toBeGreaterThan(0);
          expect(isUnitCode(i.u), `${r.id}/${i.p}: ${i.u}`).toBe(true);
        }
      }
      const ingredientIds = r.ingredients.map((i) => i.p);
      expect(new Set(ingredientIds).size, `${r.id}: ingredient repetat`).toBe(ingredientIds.length);
    }
  });

  it("acoperă toate categoriile și rețetele românești cerute", () => {
    for (const c of ["mic_dejun", "pranz", "cina", "gustari", "supe_ciorbe", "traditionale", "carne", "peste", "vegetariene", "salate", "deserturi", "rapide", "meal_prep"]) {
      expect(RECIPE_SEEDS.some((r) => r.categories.includes(c as never)), c).toBe(true);
    }
    for (const id of [
      "ciorba-de-perisoare", "ciorba-de-legume", "ciorba-de-pui", "supa-de-pui-cu-taitei", "sarmale", "ardei-umpluti", "tocanita-de-porc",
      "ostropel-de-pui", "pilaf-de-pui", "mancare-de-fasole-cu-carnati", "ghiveci-de-legume", "salata-de-vinete", "salata-de-boeuf",
      "chiftele-de-porc-vita", "peste-la-cuptor-cu-legume", "mamaliga-cu-branza-si-smantana",
    ]) {
      expect(RECIPE_SEEDS.some((r) => r.id === id), id).toBe(true);
    }
    expect(RECIPE_SEEDS.filter((r) => r.cuisine === "internationala").length).toBeGreaterThanOrEqual(10);
  });

  it("are 100 de rețete noi ușoare sau medii (al doilea set)", () => {
    const set = [...USOARE_MIC_DEJUN_GUSTARI, ...USOARE_SUPE_LEGUME, ...USOARE_CARNE_PESTE, ...USOARE_PASTE_DESERTURI];
    expect(set).toHaveLength(100);
    expect(set.filter((r) => r.difficulty === "dificil").map((r) => r.id)).toEqual([]);
  });

  it("nu conține valori nutriționale sau prețuri inventate", () => {
    const c = buildCatalog();
    expect(c.recipes.every((r) => r.nutrition === null)).toBe(true);
  });
});

describe("seed-ul SQL", () => {
  it("e la zi cu datele din src/data (rulează npm run seed:sql)", () => {
    expect(readFileSync(new URL("../../supabase/seed.sql", import.meta.url), "utf8")).toBe(seedSql());
  });
});

describe("valorile nutriționale (.tasks/016, etapa 4)", () => {
  it("sunt doar pentru produsele alimentare din catalog, la 100 g, în limite plauzibile", () => {
    const food = new Set(CATEGORY_SEEDS.filter((c) => c.is_food).map((c) => c.id));
    const category = new Map(PRODUCT_SEEDS.map((p) => [p.id, p.category]));
    const wrong = Object.entries(NUTRITION_SEEDS).filter(([id, n]) => {
      const cat = category.get(id);
      const values = [n.protein_g, n.carbs_g, n.fat_g];
      return (
        cat === undefined ||
        !food.has(cat) ||
        !Number.isInteger(n.code) ||
        n.kcal < 0 ||
        n.kcal > 900 ||
        values.some((v) => v < 0) ||
        n.protein_g + n.carbs_g + n.fat_g > 101 // rotunjirile sursei (uleiul: 100 + 0,25)
      );
    });
    expect(wrong).toEqual([]);
  });
});
