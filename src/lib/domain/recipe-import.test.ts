import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildIndex } from "./search";
import {
  cleanSourceUrl,
  draftFromHtml,
  draftFromText,
  extractJsonLd,
  findRecipeNode,
  matchIngredients,
  metricText,
  phraseDictionary,
  parseIngredientLine,
  parseIsoDuration,
} from "./recipe-import";

const fixture = (name: string) => readFileSync(new URL(`./__fixtures__/recipe-import/${name}`, import.meta.url), "utf8");

describe("durate ISO 8601", () => {
  it.each([
    ["PT30M", 30],
    ["PT1H15M", 75],
    ["PT2H", 120],
    ["P0DT45M", 45],
    ["PT90S", 2],
    ["P1D", 1440],
  ])("%s → %i minute", (input, minutes) => {
    expect(parseIsoDuration(input)).toBe(minutes);
  });

  it.each([["30 de minute"], ["PT"], ["P"], [""], [null], [45], ["P3D"]])("%s → null", (input) => {
    expect(parseIsoDuration(input)).toBeNull();
  });
});

describe("adresa sursei", () => {
  it("păstrează https, fără fragment și fără parametrii de urmărire", () => {
    expect(cleanSourceUrl(" https://exemplu.ro/reteta?id=5&utm_source=fb&fbclid=abc#comentarii ")).toBe("https://exemplu.ro/reteta?id=5");
  });

  it.each([["http://exemplu.ro/reteta"], ["javascript:alert(1)"], ["nu e link"], ["https://user:parola@exemplu.ro/"], [`https://exemplu.ro/${"a".repeat(500)}`]])(
    "refuză %s",
    (input) => {
      expect(cleanSourceUrl(input)).toBeNull();
    },
  );
});

describe("JSON-LD", () => {
  it("găsește rețeta în @graph, sare peste blocurile stricate și ignoră poza și valorile nutriționale", () => {
    const draft = draftFromHtml(fixture("graph-wordpress.html"), "https://exemplu.ro/ciorba?utm_medium=social");
    expect(draft).toEqual({
      name: "Ciorbă de perișoare & leuștean",
      description: "Ciorbă acrită cu borș, ca la bunica.",
      servings: 6,
      prep_minutes: 30,
      cook_minutes: 75,
      ingredients: ["500 g carne tocată de porc", "1 ceapă mare, tocată", "2 morcovi", "3 linguri de orez", "1 l borș", "sare după gust", "1 legătură leuștean"],
      steps: [
        "Amestecă carnea cu orezul și formează perișoare.",
        "Fierbe legumele 20 de minute.",
        "Adaugă perișoarele și borșul – fierbe încă 30 de minute.",
      ],
      source_url: "https://exemplu.ro/ciorba",
    });
  });

  it("acceptă @type ca listă, porțiile ca număr, pașii într-un singur text; timpul total nu devine timp de gătit", () => {
    const draft = draftFromHtml(fixture("direct-array-type.html"));
    expect(draft).toMatchObject({
      name: "Clătite cu dulceață",
      servings: 4,
      prep_minutes: 10,
      cook_minutes: null,
      steps: ["Bate ouăle cu laptele.", "Adaugă făina și sarea.", "Coace clătitele într-o tigaie unsă."],
      source_url: null,
    });
    expect(draft?.ingredients).toHaveLength(5);
  });

  it("întoarce null pentru o pagină fără rețetă", () => {
    expect(extractJsonLd(fixture("fara-reteta.html"))).toHaveLength(1);
    expect(draftFromHtml(fixture("fara-reteta.html"))).toBeNull();
    expect(draftFromHtml("<html><body>Nimic</body></html>")).toBeNull();
  });

  it("acceptă @type cu adresa completă a schemei", () => {
    const html = `<script type="application/ld+json">{"@type":"https://schema.org/Recipe","name":"Mămăligă","recipeIngredient":["500 g mălai"]}</script>`;
    expect(draftFromHtml(html)?.name).toBe("Mămăligă");
  });

  it("găsește rețeta și în mainEntity", () => {
    expect(findRecipeNode({ "@type": "WebPage", mainEntity: { "@type": "Recipe", name: "Zacuscă" } })).toEqual({ "@type": "Recipe", name: "Zacuscă" });
  });

  it("nu acceptă o rețetă fără ingrediente și fără pași", () => {
    const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Goală"}</script>`;
    expect(draftFromHtml(html)).toBeNull();
  });

  it.each([
    ["4-6 porții", null],
    ["Pentru 4 persoane", 4],
    ["100", null],
    ["2.5 porții", null],
    ["", null],
  ])("porțiile „%s” → %s", (recipeYield, servings) => {
    const html = `<script type="application/ld+json">${JSON.stringify({ "@type": "Recipe", name: "X", recipeYield, recipeIngredient: ["1 ou"] })}</script>`;
    expect(draftFromHtml(html)?.servings).toBe(servings);
  });
});

describe("textul lipit", () => {
  it("descrierea de pe Instagram: fără emoji și hashtaguri, cu secțiuni și numerotarea scoasă", () => {
    expect(draftFromText(fixture("instagram-ro.txt"))).toEqual({
      name: "Paste cu pui și ciuperci, gata în 30 de minute",
      description: "Cina perfectă pentru serile aglomerate 😍",
      servings: 4,
      prep_minutes: null,
      cook_minutes: null,
      ingredients: [
        "400 g paste penne",
        "2 piept de pui",
        "300g ciuperci",
        "200 ml smântână de gătit",
        "2-3 căței de usturoi",
        "ulei de măsline extravirgin",
        "sare și piper după gust",
      ],
      steps: [
        "Fierbe pastele conform instrucțiunilor de pe pachet.",
        "Călește puiul tăiat cubulețe în ulei.",
        "Adaugă ciupercile, usturoiul și smântâna.",
        "Amestecă totul și servește cald.",
      ],
      source_url: null,
    });
  });

  it("text în engleză", () => {
    const draft = draftFromText(fixture("text-en.txt"));
    expect(draft).toMatchObject({ name: "Banana bread", servings: 8, steps: ["Mash the bananas.", "Mix everything and bake for 1 hour at 175°C."] });
    expect(draft?.ingredients).toEqual(["3 ripe bananas", "1 1/2 cups flour", "½ cup sugar", "1 tsp baking soda", "a pinch of salt", "2 tbsp butter, melted"]);
  });

  it("fără titluri de secțiuni: rândurile cu cantitate sunt ingrediente, restul pași", () => {
    expect(draftFromText(fixture("text-fara-titluri.txt"))).toMatchObject({
      name: "Salată de vinete",
      ingredients: ["2 vinete mari", "o ceapă mică", "3 linguri ulei"],
      steps: ["Coace vinetele pe plită până se înmoaie coaja.", "Curăță-le și toacă-le cu ceapa și uleiul."],
    });
  });

  it("subtitlurile din secțiuni nu devin ingrediente", () => {
    const draft = draftFromText("Tort\nIngrediente:\nPentru blat:\n4 ouă\nPentru cremă:\n200 g mascarpone\nPreparare:\nCoace blatul.");
    expect(draft?.ingredients).toEqual(["4 ouă", "200 g mascarpone"]);
  });

  it("fără titluri: pașii numerotați nu devin ingrediente", () => {
    const draft = draftFromText("Ciorbă\n500 g carne\n2 morcovi\n1. Fierbe carnea.\n2. Adaugă morcovii.");
    expect(draft).toMatchObject({ ingredients: ["500 g carne", "2 morcovi"], steps: ["Fierbe carnea.", "Adaugă morcovii."] });
  });

  it("porțiile: din titlul ingredientelor, numărul de lângă cuvânt, nu din pași", () => {
    expect(draftFromText("Tocăniță\nIngrediente pentru 4 persoane:\n1 kg cartofi\nPreparare:\nGătește.")?.servings).toBe(4);
    expect(draftFromText("Tocăniță\n2 linguri ulei, pentru 4 persoane\nIngrediente:\n1 kg cartofi")?.servings).toBe(4);
    const draft = draftFromText("Cozonac\nIngrediente:\n1 kg făină\nPreparare:\nÎmparte aluatul în 8 porții egale.");
    expect(draft).toMatchObject({ servings: null, steps: ["Împarte aluatul în 8 porții egale."] });
  });

  it("pasul care începe cu un interval de minute își păstrează numerele", () => {
    expect(draftFromText("Prăjitură\nPreparare:\n10 - 12 minute la cuptor.")?.steps).toEqual(["10 - 12 minute la cuptor."]);
  });

  it("păstrează „#1” din text, scoate doar hashtagurile", () => {
    expect(draftFromText("Rețeta #1 a casei #foodie\nIngrediente:\n1 ou")?.name).toBe("Rețeta #1 a casei");
  });

  it("un text fără ingrediente și fără pași nu e rețetă", () => {
    expect(draftFromText("")).toBeNull();
    expect(draftFromText("#reteta #foodie")).toBeNull();
    expect(draftFromText("Doar un titlu")).toBeNull();
  });
});

describe("rândul de ingredient", () => {
  it.each([
    ["500 g carne tocată", { quantity: 500, unit: "g", name: "carne tocată", note: null, optional: false }],
    ["2 linguri de ulei", { quantity: 2, unit: "lingura", name: "ulei", note: null, optional: false }],
    ["1,5 kg cartofi", { quantity: 1.5, unit: "kg", name: "cartofi", note: null, optional: false }],
    ["1,5 kg cartofi, curățați", { quantity: 1.5, unit: "kg", name: "cartofi", note: "curățați", optional: false }],
    ["300g ciuperci", { quantity: 300, unit: "g", name: "ciuperci", note: null, optional: false }],
    ["1/2 linguriță sare", { quantity: 0.5, unit: "lingurita", name: "sare", note: null, optional: false }],
    ["½ cană lapte", { quantity: 0.5, unit: "cana", name: "lapte", note: null, optional: false }],
    ["1 1/2 cups flour", { quantity: 360, unit: "ml", name: "flour", note: null, optional: false }],
    ["1 ½ cană apă", { quantity: 1.5, unit: "cana", name: "apă", note: null, optional: false }],
    ["3 ouă", { quantity: 3, unit: null, name: "ouă", note: null, optional: false }],
    ["o ceapă mare, tocată", { quantity: 1, unit: null, name: "ceapă mare", note: "tocată", optional: false }],
    ["un ou", { quantity: 1, unit: null, name: "ou", note: null, optional: false }],
    ["3 căței usturoi", { quantity: 3, unit: "catel", name: "usturoi", note: null, optional: false }],
    ["1 l borș", { quantity: 1, unit: "l", name: "borș", note: null, optional: false }],
    ["1 lb ground beef", { quantity: 454, unit: "g", name: "ground beef", note: null, optional: false }],
    ["100 ml (1/2 cană) lapte", { quantity: 100, unit: "ml", name: "lapte", note: "1/2 cană", optional: false }],
    ["2 tbsp butter, melted", { quantity: 2, unit: "lingura", name: "butter", note: "melted", optional: false }],
    ["a cup of sugar", { quantity: 240, unit: "ml", name: "sugar", note: null, optional: false }],
    ["1 lingură zahăr (opțional)", { quantity: 1, unit: "lingura", name: "zahăr", note: null, optional: true }],
    ["50 g nuci opțional", { quantity: 50, unit: "g", name: "nuci", note: null, optional: true }],
  ])("%s", (line, expected) => {
    expect(parseIngredientLine(line)).toEqual({ text: line, ...expected });
  });

  it.each([
    ["sare după gust", { name: "sare", note: "după gust" }],
    ["sare și piper după gust", { name: "sare și piper", note: "după gust" }],
    ["un praf de sare", { name: "sare", note: "un praf" }],
    ["un vârf de cuțit de piper", { name: "piper", note: "un praf" }],
    ["a pinch of salt", { name: "salt", note: "un praf" }],
    ["salt to taste", { name: "salt", note: "după gust" }],
    ["2-3 căței de usturoi", { name: "usturoi", note: "2–3 căței" }],
    ["2 - 3 morcovi", { name: "morcovi", note: "2–3" }],
    ["ulei de măsline extravirgin", { name: "ulei de măsline extravirgin", note: null }],
    ["1.000 ml apă", { name: "apă", note: "1.000 ml" }],
    ["1,500 kg cartofi", { name: "cartofi", note: "1,500 kg" }],
    ["2 pumni de nuci", { name: "nuci", note: "2 pumni" }],
    ["un fir de ceapă verde", { name: "ceapă verde", note: "un fir" }],
    ["2 până la 3 ouă", { name: "ouă", note: "2–3" }],
  ])("%s: fără cantitate", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject({ quantity: null, unit: null, ...expected });
  });

  it.each([
    ["2 linguri praf de cacao", { quantity: 2, unit: "lingura", name: "praf de cacao", note: null }],
    ["100 g praf de usturoi", { quantity: 100, unit: "g", name: "praf de usturoi", note: null }],
    ["jumătate de lămâie", { quantity: 0.5, unit: null, name: "lămâie", note: null }],
    ["0,250 kg unt", { quantity: 0.25, unit: "kg", name: "unt", note: null }],
  ])("%s: cantitatea rămâne", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });

  it("„praf de copt” e un produs, nu „un praf”", () => {
    expect(parseIngredientLine("1 plic praf de copt")).toMatchObject({ quantity: 1, unit: "plic", name: "praf de copt", note: null });
  });

  it("nu ia unitatea drept nume când după ea nu mai urmează nimic", () => {
    expect(parseIngredientLine("200 g")).toMatchObject({ quantity: 200, unit: null, name: "g" });
  });
});

describe("unitățile imperiale → metric (.tasks/011)", () => {
  it.each([
    ["1 cup milk", { quantity: 240, unit: "ml", name: "milk" }],
    ["3/4 cup sugar", { quantity: 180, unit: "ml", name: "sugar" }],
    ["1/3 cup olive oil", { quantity: 80, unit: "ml", name: "olive oil" }],
    ["8 fl oz milk", { quantity: 240, unit: "ml", name: "milk" }],
    ["2 fl. oz. cream", { quantity: 60, unit: "ml", name: "cream" }],
    ["1 pint heavy cream", { quantity: 473, unit: "ml", name: "heavy cream" }],
    ["1 quart chicken stock", { quantity: 946, unit: "ml", name: "chicken stock" }],
    ["1 gallon water", { quantity: 3785, unit: "ml", name: "water" }],
    ["1 stick butter, softened", { quantity: 113, unit: "g", name: "butter", note: "softened" }],
    ["2 sticks unsalted butter", { quantity: 226, unit: "g", name: "unsalted butter" }],
    ["1 1/2 lbs chicken thighs", { quantity: 680, unit: "g", name: "chicken thighs" }],
    ["½ cană lapte", { quantity: 0.5, unit: "cana", name: "lapte" }],
  ])("%s", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });

  it("un „stick” care nu e de unt rămâne în notă", () => {
    expect(parseIngredientLine("2 sticks celery")).toMatchObject({ quantity: null, unit: null, name: "celery", note: "2 sticks" });
  });

  it.each([
    ["2 sticks butternut squash", { quantity: null, unit: null, name: "butternut squash", note: "2 sticks" }],
    ["2 pt salată", { quantity: 2, unit: null, name: "pt salată" }],
    ["1 qt ulei", { quantity: 1, unit: null, name: "qt ulei" }],
    ["8 fl oz", { quantity: 8, unit: null, name: "fl oz" }],
  ])("%s: nu se transformă", (line, expected) => {
    expect(parseIngredientLine(line)).toMatchObject(expected);
  });

  it.each([
    ["Preheat oven to 350°F.", "Preheat oven to 175°C."],
    ["Bake at 375 degrees F for 25 minutes.", "Bake at 190°C for 25 minutes."],
    ["Heat the oven to 425 F.", "Heat the oven to 220°C."],
    ["Roast at 400 degrees Fahrenheit.", "Roast at 205°C."],
    ["Cook until it reaches 165°F inside.", "Cook until it reaches 75°C inside."],
    ["Preheat oven to 350°F (175°C).", "Preheat oven to 175°C."],
    ["Preheat oven to 350°F/180°C.", "Preheat oven to 180°C."],
    ["Preheat oven to 180°C (350°F).", "Preheat oven to 180°C."],
    ["Coacem la 180°C, 40 de minute.", "Coacem la 180°C, 40 de minute."],
    ["Grease a 9x13 inch baking pan.", "Grease a 23×33 cm baking pan."],
    ["Use a 9 x 13-inch dish.", "Use a 23×33 cm dish."],
    ["Pour into a 9-inch round pan.", "Pour into a 23 cm round pan."],
    ["Cut into 1/2-inch pieces.", "Cut into 1,5 cm pieces."],
    ["Cut into 1-inch cubes, about 2 inches long.", "Cut into 2,5 cm cubes, about 5 cm long."],
    ["Cut into 1/4 inch slices.", "Cut into 0,5 cm slices."],
    ["Add 2 F sticks.", "Add 2 F sticks."],
    ["Adaugă 250 făină și frământă.", "Adaugă 250 făină și frământă."],
    ["Taie 300 fâșii, apoi 250 Feliuțe.", "Taie 300 fâșii, apoi 250 Feliuțe."],
    ["Bake at 350-375°F.", "Bake at 175–190°C."],
    ["Bake at 350 to 375 degrees F.", "Bake at 175–190°C."],
    ["Heat to 1350°F.", "Heat to 1350°F."],
    ["Preheat to 350°F, or 175°C.", "Preheat to 175°C."],
    ["Bake at 180°C and 350°F.", "Bake at 180°C."],
    ["Cut 1-2 inches thick.", "Cut 2,5–5 cm thick."],
    ["Taie fâșii de 2 cm.", "Taie fâșii de 2 cm."],
    ["Mix in a bowl.", "Mix in a bowl."],
  ])("%s", (step, expected) => {
    expect(metricText(step)).toBe(expected);
  });
});

describe("potrivirea cu catalogul", () => {
  const index = buildIndex([
    { id: "carne-tocata", name: "Carne tocată de porc", terms: ["carne tocata"] },
    { id: "ceapa", name: "Ceapă", terms: ["ceapă galbenă"] },
    { id: "ulei-masline", name: "Ulei de măsline", terms: [] },
    { id: "ulei-floarea", name: "Ulei de floarea-soarelui", terms: ["ulei"] },
    { id: "rosii", name: "Roșii", terms: [] },
    { id: "usturoi", name: "Usturoi", terms: [] },
    { id: "sare", name: "Sare", terms: [] },
    { id: "smantana", name: "Smântână", terms: ["smantana de gatit"] },
    { id: "unt", name: "Unt", terms: [] },
    { id: "lapte", name: "Lapte", terms: [] },
  ]);
  const match = (line: string) => matchIngredients([parseIngredientLine(line)], index)[0];

  it.each([
    ["500 g carne tocată", "carne-tocata"],
    ["o ceapă mare, tocată", "ceapa"],
    ["ulei de măsline extravirgin", "ulei-masline"],
    ["2 linguri de ulei", "ulei-floarea"],
    ["3 rosii", "rosii"],
    ["2-3 căței de usturoi", "usturoi"],
    ["sare după gust", "sare"],
    ["200 ml smântână de gătit", "smantana"],
  ])("%s → %s, bifat", (line, id) => {
    expect(match(line).product_id).toBe(id);
  });

  it.each([["unt de arahide", "unt"], ["lapte de cocos", "lapte"]])("%s: produsul mai general e doar variantă, nebifat", (line, id) => {
    expect(match(line)).toMatchObject({ product_id: null, candidates: [id] });
  });

  it("singularul se potrivește cu pluralul din catalog", () => {
    expect(match("o roșie").product_id).toBe("rosii");
  });

  it("o potrivire doar aproximativă (greșeală de tastare) rămâne de ales, cu variante", () => {
    const typo = match("ustoroi");
    expect(typo.product_id).toBeNull();
    expect(typo.candidates).toContain("usturoi");
  });

  describe("cu dicționarul englez–român", () => {
    const known = phraseDictionary([["butter", "unt"], ["peanut butter", null], ["milk", "lapte"], ["chicken breast", "piept"], ["chicken", "pui"], ["all purpose flour", "faina"], ["confectioners sugar", "pudra"], ["tomato", "rosii"], ["cherry", "cirese"], ["peach", "piersici"], ["bay leaf", "dafin"]]);
    const en = (line: string) => matchIngredients([parseIngredientLine(line)], index, 5, known)[0];

    it.each([
      ["2 tbsp unsalted butter, melted", "unt"],
      ["1 cup whole milk", "lapte"],
      ["2 large chicken breasts", "piept"],
      ["1 whole chicken", "pui"],
      ["2 cups all-purpose flour", "faina"],
      ["1 cup confectioners' sugar", "pudra"],
      ["3 ripe tomatoes", "rosii"],
      ["1 cup cherries", "cirese"],
      ["2 peaches", "piersici"],
      ["2 bay leaves", "dafin"],
    ])("%s → %s, bifat", (line, id) => {
      expect(en(line)).toMatchObject({ product_id: id, candidates: [id] });
    });

    it("produsul găsit doar în notă e o variantă, nebifată („seasoned with salt” nu e sare)", () => {
      expect(en("2 boneless, skinless chicken breasts")).toMatchObject({ product_id: null, candidates: ["piept"] });
      expect(en("1 lb steak, seasoned with butter")).toMatchObject({ product_id: null, candidates: ["unt"] });
    });

    it("o expresie oprită nu ia produsul unui cuvânt din ea („peanut butter” nu e unt)", () => {
      expect(en("2 tbsp peanut butter")).toMatchObject({ product_id: null, candidates: [] });
    });

    it("rândurile românești merg ca înainte", () => {
      expect(en("200 ml smântână de gătit").product_id).toBe("smantana");
      expect(en("unt de arahide")).toMatchObject({ product_id: null, candidates: ["unt"] });
    });
  });

  it("fără nicio potrivire: de ales de om, fără variante", () => {
    expect(match("1 tsp baking soda")).toMatchObject({ product_id: null, candidates: [] });
  });
});
