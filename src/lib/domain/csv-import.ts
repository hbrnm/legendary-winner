import type { UnitCode } from "./types";
import { isUnitCode } from "./units";
import { normalize } from "./search";

/** Citește CSV cu separator „;” sau „,” (detectat din antet), cu ghilimele. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

export interface ProductImportRow {
  line: number;
  name: string;
  category_id: string;
  default_unit: UnitCode;
  aliases: string[];
  ean: string | null;
  is_market_typical: boolean;
}

export interface ImportResult {
  rows: ProductImportRow[];
  errors: { line: number; message: string }[];
  /** Produse care există deja (după denumire) și se vor sări. */
  duplicates: { line: number; name: string }[];
}

const HEADER: Record<string, keyof Omit<ProductImportRow, "line">> = {
  nume: "name",
  denumire: "name",
  categorie: "category_id",
  unitate: "default_unit",
  sinonime: "aliases",
  ean: "ean",
  piata: "is_market_typical",
};

/**
 * Importul controlat de produse. Coloane: nume; categorie (id sau nume);
 * unitate; sinonime (separate cu |); ean; piata (da/nu). Rândurile cu erori
 * nu se importă, iar produsele existente nu se dublează.
 */
export function parseProductImport(text: string, categories: { id: string; name: string }[], existingNames: string[]): ImportResult {
  const table = parseCsv(text);
  const out: ImportResult = { rows: [], errors: [], duplicates: [] };
  if (table.length === 0) {
    out.errors.push({ line: 1, message: "Fișierul e gol." });
    return out;
  }
  const header = table[0].map((h) => HEADER[normalize(h)]);
  if (!header.includes("name") || !header.includes("category_id") || !header.includes("default_unit")) {
    out.errors.push({ line: 1, message: "Antetul trebuie să conțină cel puțin coloanele: nume, categorie, unitate." });
    return out;
  }
  const catByKey = new Map<string, string>();
  for (const c of categories) {
    catByKey.set(normalize(c.id), c.id);
    catByKey.set(normalize(c.name), c.id);
  }
  const seen = new Set(existingNames.map(normalize));
  table.slice(1).forEach((cells, k) => {
    const line = k + 2;
    const get = (key: keyof Omit<ProductImportRow, "line">) => (cells[header.indexOf(key)] ?? "").trim();
    const name = get("name");
    const category = catByKey.get(normalize(get("category_id")));
    const unit = normalize(get("default_unit"));
    const ean = get("ean") || null;
    if (!name || name.length > 120) return out.errors.push({ line, message: "Numele lipsește sau e prea lung." });
    if (!category) return out.errors.push({ line, message: `Categoria „${get("category_id")}” nu există.` });
    if (!isUnitCode(unit)) return out.errors.push({ line, message: `Unitatea „${get("default_unit")}” nu e cunoscută.` });
    if (ean && !/^(\d{8}|\d{12,14})$/.test(ean)) return out.errors.push({ line, message: "Codul EAN trebuie să aibă 8, 12, 13 sau 14 cifre." });
    if (seen.has(normalize(name))) return out.duplicates.push({ line, name });
    seen.add(normalize(name));
    out.rows.push({
      line,
      name,
      category_id: category,
      default_unit: unit,
      aliases: get("aliases").split("|").map((a) => a.trim()).filter(Boolean),
      ean,
      is_market_typical: /^(da|1|true|x)$/i.test(get("is_market_typical")),
    });
  });
  return out;
}
