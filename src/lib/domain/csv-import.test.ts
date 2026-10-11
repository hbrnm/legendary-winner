import { describe, expect, it } from "vitest";
import { parseCsv, parseProductImport } from "./csv-import";

const cats = [
  { id: "legume", name: "Legume și verdețuri" },
  { id: "lactate", name: "Lactate" },
];

describe("import CSV", () => {
  it("citește ghilimele, separatorul „;” și BOM", () => {
    expect(parseCsv('﻿a;b\r\n"x;y";"spune ""da"""\n')).toEqual([
      ["a", "b"],
      ["x;y", 'spune "da"'],
    ]);
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("validează rândurile, sare dublurile și raportează erorile pe linie", () => {
    const csv = [
      "Nume;Categorie;Unitate;Sinonime;EAN;Piață",
      "Ardei lungi;legume;kg;ardei lung|ardei de copt;;da",
      "Lapte de capră;Lactate;l;;5941234567890;nu",
      "Roșii;legume;kg;;;",
      "Necunoscut;bauturi;kg;;;",
      "Brânză;lactate;galon;;;",
      ";legume;kg;;;",
      "Ardei lungi;legume;kg;;;",
    ].join("\n");
    const r = parseProductImport(csv, cats, ["Roșii"]);
    expect(r.rows).toEqual([
      { line: 2, name: "Ardei lungi", category_id: "legume", default_unit: "kg", aliases: ["ardei lung", "ardei de copt"], ean: null, is_market_typical: true },
      { line: 3, name: "Lapte de capră", category_id: "lactate", default_unit: "l", aliases: [], ean: "5941234567890", is_market_typical: false },
    ]);
    expect(r.duplicates.map((d) => d.line)).toEqual([4, 8]);
    expect(r.errors.map((e) => e.line)).toEqual([5, 6, 7]);
  });

  it("cere coloanele obligatorii", () => {
    expect(parseProductImport("Nume;Preț\nX;3", cats, []).errors[0].message).toMatch(/nume, categorie, unitate/);
  });
});
