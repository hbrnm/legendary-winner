import type { Product, UnitCode } from "@/lib/domain/types";
import { draftFromText, matchIngredients, parseIngredientLine, type RecipeDraft } from "@/lib/domain/recipe-import";
import { type AppCtx, UserError } from "./context";
import { productSearchIndex } from "./catalog";
import { visible } from "./queries";

// Importul rețetelor (.tasks/009, etapa 3): din link (funcția Edge
// import-recipe) sau din text lipit (în telefon, merge și offline) se face o
// ciornă pe care formularul rețetei o arată pentru confirmare.

/** Un ingredient din ciornă: potrivit cu un produs (bifat) sau de ales de om (`product_id` null). */
export interface ImportedIngredient {
  /** Rândul original din rețetă. */
  text: string;
  /** Denumirea citită din rând, propusă pentru un produs nou. */
  name: string;
  product_id: string | null;
  quantity: number | null;
  unit: UnitCode | null;
  note: string | null;
  optional: boolean;
  /** Produsele propuse, cele mai potrivite primele. */
  candidates: Pick<Product, "id" | "name">[];
}

export interface PreparedImport {
  draft: RecipeDraft;
  ingredients: ImportedIngredient[];
}

/** Citește fiecare rând de ingredient și caută produsul în catalogul gospodăriei. */
export async function prepareImport(ctx: AppCtx, draft: RecipeDraft): Promise<PreparedImport> {
  const products = new Map((await visible(ctx.db, "products", ctx.householdId)).map((p) => [p.id, p]));
  // Pentru rețete se propun doar alimente (nu „pastă de dinți” pentru „pastă de ardei”).
  const nonFood = new Set((await visible(ctx.db, "product_categories", ctx.householdId)).filter((c) => !c.is_food).map((c) => c.id));
  const isFood = (id: string) => !nonFood.has(products.get(id)?.category_id ?? "");
  const matches = matchIngredients(draft.ingredients.map(parseIngredientLine), await productSearchIndex(ctx));
  const ingredients = matches.map(({ ingredient: i, product_id, candidates }) => ({
    text: i.text,
    name: i.name,
    product_id: product_id && isFood(product_id) ? product_id : null,
    quantity: i.quantity,
    // Un număr fără unitate („1 ceapă”) înseamnă bucăți.
    unit: i.unit ?? (i.quantity != null ? "buc" : null),
    note: i.note,
    optional: i.optional,
    candidates: candidates.flatMap((id) => {
      const p = products.get(id);
      return p && isFood(id) ? [{ id: p.id, name: p.name }] : [];
    }),
  }));
  return { draft, ingredients };
}

/** Ciorna din textul lipit (descrierea de pe Instagram, TikTok, Facebook). */
export function draftFromPastedText(text: string): RecipeDraft {
  const draft = draftFromText(text);
  if (!draft) throw new UserError("Nu am găsit o rețetă în text. Pune numele pe primul rând, apoi ingredientele și pașii.");
  return draft;
}

export type ImportErrorCode = "bad_request" | "unauthorized" | "rate_limited" | "invalid_url" | "blocked_address" | "fetch_failed" | "timeout" | "too_large" | "not_html" | "no_recipe";

const PASTE_TEXT = "Copiază textul rețetei de pe pagină și lipește-l la „Text”.";

export const IMPORT_ERROR_MESSAGES: Record<ImportErrorCode, string> = {
  bad_request: "Nu am putut citi linkul. Încearcă din nou.",
  unauthorized: "Conectează-te din nou, apoi încearcă iar.",
  rate_limited: "Ai importat multe rețete în ultima oră. Încearcă din nou mai târziu.",
  invalid_url: "Linkul nu e bun. Copiază adresa întreagă a rețetei, care începe cu https://.",
  blocked_address: "Nu pot deschide acest link. Încearcă linkul altei rețete.",
  fetch_failed: "Nu am putut deschide pagina. Verifică linkul și încearcă din nou.",
  timeout: "Pagina se încarcă prea greu. Încearcă din nou puțin mai târziu.",
  too_large: `Pagina e prea mare. ${PASTE_TEXT}`,
  not_html: `Linkul nu duce la o pagină cu rețetă. ${PASTE_TEXT}`,
  no_recipe: `Nu găsesc rețeta pe pagină. ${PASTE_TEXT}`,
};

/** Cererea către funcția Edge: corpul JSON → răspunsul serverului. */
export type ImportCall = (body: { url: string }) => Promise<Response>;

/** Ciorna din pagina unei rețete, prin funcția Edge; erorile devin mesaje pentru om. */
export async function draftFromLink(link: string, call: ImportCall): Promise<RecipeDraft> {
  const url = link.trim();
  if (!/^https:\/\/\S+$/i.test(url)) throw new UserError(IMPORT_ERROR_MESSAGES.invalid_url);
  let res: Response;
  try {
    res = await call({ url });
  } catch {
    throw new UserError("Nu am putut ajunge la server. Verifică internetul și încearcă din nou.");
  }
  const body = (await res.json().catch(() => null)) as { draft?: RecipeDraft; error?: string } | null;
  if (res.ok && body?.draft) return body.draft;
  const code = body?.error as ImportErrorCode | undefined;
  throw new UserError((code && IMPORT_ERROR_MESSAGES[code]) ?? IMPORT_ERROR_MESSAGES.fetch_failed);
}
