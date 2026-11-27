import type { Product } from "@/lib/domain/types";
import { ingredientPreparation, scaleNutrition, type ProductNutrition } from "@/lib/domain/recipes";
import { normalize } from "@/lib/domain/search";
import type { ProductNutritionLabel } from "@/lib/domain/calories";
import { NUTRITION_SEEDS } from "./nutrition";
import { NUTRITION_UNITS } from "./nutrition-units";

type NutritionEquivalent = string | readonly [productId: string, estimate: true | string];

const RECIPE_NUTRITION_EQUIVALENTS: Readonly<Record<string, NutritionEquivalent>> = {
  "reteta-bagheta-integrala": ["paine-integrala", true],
  "reteta-boia": ["boia-dulce", true],
  "reteta-buchetele-mici-de-broccoli": "broccoli",
  "reteta-busuioc": ["busuioc-proaspat", true],
  "reteta-capere-scurse": "capere",
  "reteta-cascaval-feliat": ["cascaval", true],
  "reteta-coriandru-sau-patrunjel": ["patrunjel-verde", "pătrunjel"],
  "reteta-creveti-decorticati-cruzi": "creveti",
  "reteta-dovlecel-proaspat-feliat-subtire": "dovlecei",
  "reteta-dressing-ulei-de-masline": "ulei-masline",
  "reteta-file-de-salau-sau-cod-crud": ["file-cod", "cod"],
  "reteta-frunze-proaspete-de-varza-kale-fara-cotor": "kale",
  "reteta-fulgi-de-chili": ["ardei-iute-uscat", true],
  "reteta-fulgi-de-ovaz-fini": "fulgi-ovaz",
  "reteta-lamaie-feliata": ["lamai", "pulpă de lămâie"],
  "reteta-lapte-1-5-sau-bautura-vegetala": ["lapte-semidegresat", "lapte semidegresat"],
  "reteta-lapte-semidegresat-1-5-sau-bautura-vegetala": ["lapte-semidegresat", "lapte semidegresat"],
  "reteta-malai-grisat-uscat": "malai",
  "reteta-mar-proaspat-curatat-de-cotor": "mere",
  "reteta-miez-de-nuca-maruntit": "nuci-miez",
  "reteta-orez-arborio-sau-carnaroli-uscat": ["orez-bob-rotund", true],
  "reteta-paine-integrala-cu-maia": ["paine-integrala", true],
  "reteta-pastai-de-fasole-verde": "fasole-verde",
  "reteta-sparanghel-sau-fasole-verde-pentru-garnitura": ["fasole-verde", "fasole verde"],
  "reteta-tije-de-telina-apio-curatate": "telina-apio",
  "reteta-topping-kiwi-proaspat-feliat": "kiwi",
  "reteta-ulei-pentru-uns-tigaia": ["ulei-floarea-soarelui", "ulei de floarea-soarelui"],
  "reteta-ardei-grasi-curatati-de-cotor": "ardei-gras",
  "reteta-baby-spanac-proaspat": "spanac",
  "reteta-buchetele-de-broccoli-crude": "broccoli",
  "reteta-cartofi-albi-curatati-cruzi": "cartofi-albi",
  "reteta-cartofi-noi-mici-cruzi": "cartofi-noi",
  "reteta-file-de-cod-proaspat-decongelat-crud": "file-cod",
  "reteta-fulgi-de-ovaz-integrali-uscati": "fulgi-ovaz",
  "reteta-lapte-1-5-grasime": "lapte-semidegresat",
  "reteta-marar-proaspat-tocat": "marar",
  "reteta-mustar-clasic": "mustar",
  "reteta-pastai-de-fasole-verde-crude-congelate": "fasole-verde-congelata",
  "reteta-piper-negru": "piper-negru-macinat",
  "reteta-porumb-dulce-scurs": "porumb-conserva",
  "reteta-pulpe-de-pui-dezosate-fara-piele-crude": "pulpe-pui-dezosate",
  "reteta-ridichi-rosii-proaspete": "ridichi",
  "reteta-spaghete-de-grau-dur-uscate": "paste-spaghete",
  "reteta-un-praf-de-sare": "sare",
};

/**
 * Valorile la 100 g și greutățile unităților unui produs, din catalog. Factorii
 * produsului (piece_grams, grams_per_ml) au întâietate; produsele gospodăriei
 * nu au valori (DE COMPLETAT).
 */
export function catalogNutrition(
  products: ReadonlyMap<string, Pick<Product, "piece_grams" | "grams_per_ml"> & Partial<Pick<Product, "name">>>,
  labels: readonly ProductNutritionLabel[] = [],
): (productId: string) => ProductNutrition {
  const byProduct = new Map(labels.map((label) => [label.product_id, label]));
  return (id) => {
    const p = products.get(id);
    const label = byProduct.get(id);
    const equivalent = RECIPE_NUTRITION_EQUIVALENTS[id] ?? id;
    const [referenceId, estimate] = typeof equivalent === "string" ? [equivalent, undefined] : equivalent;
    // Rețetele importate anterior pot avea un ID propriu pentru albuș.
    const nutritionId = !NUTRITION_SEEDS[referenceId] && normalize(p?.name ?? "") === "albus de ou"
      ? "albus-de-ou"
      : referenceId;
    const n = NUTRITION_SEEDS[nutritionId];
    const u = NUTRITION_UNITS[id] ?? NUTRITION_UNITS[nutritionId];
    const units = { piece_grams: p?.piece_grams ?? u?.piece_g ?? null, grams_per_ml: p?.grams_per_ml ?? u?.g_per_ml ?? null, catel_g: u?.catel_g ?? null };
    if (label) return {
      per_100g: label.basis === "g" ? label.values : null,
      per_100ml: label.basis === "ml" ? label.values : undefined,
      source: label.open_food_facts_code ? "Open Food Facts · valori confirmate" : "Eticheta produsului",
      preparation: label.preparation,
      units,
    };
    const source = n?.src === "ciqual" ? "CIQUAL" : n?.src === "usda" ? "USDA" : n?.src === "referinta" ? n.source : n ? "Medie din catalog" : undefined;
    const assumption = estimate ?? n?.estimate;
    return {
      per_100g: n ? scaleNutrition({ kcal: n.kcal, protein_g: n.protein_g, carbs_g: n.carbs_g, fat_g: n.fat_g }, n.edibleFraction ?? 1) : null,
      source: source && assumption ? `${source} · estimare${typeof assumption === "string" ? ` (${assumption})` : ""}` : source,
      preparation: ingredientPreparation(p?.name ?? "") ?? (n ? "as_sold" : undefined),
      units,
    };
  };
}
