// Dicționarul englez–român pentru importul rețetelor (.tasks/011, etapa 2):
// denumirea din rețeta în engleză → produsul din catalog. Se folosește doar la
// import, înainte de căutare; catalogul și sinonimele lui nu se schimbă.
// `null` = nu se potrivește automat, chiar dacă un cuvânt din expresie ar găsi
// alt produs („peanut butter” nu e „butter”). Scris la singular; expresia cea
// mai lungă din denumire câștigă („chicken breast” înaintea lui „chicken”), iar la
// aceeași lungime cea din dreapta („dill pickle” e murătură).
// Conținut scris de agenți: lista se aprobă de proprietar înainte de producție.

export const ENGLISH_INGREDIENTS: [string, string | null][] = [
  // Făină, cereale, paste
  ["flour", "faina-alba"], ["all purpose flour", "faina-alba"], ["plain flour", "faina-alba"], ["white flour", "faina-alba"], ["bread flour", "faina-alba"],
  ["whole wheat flour", "faina-integrala"], ["wholemeal flour", "faina-integrala"],
  ["almond flour", null], ["coconut flour", null], ["rice flour", null],
  ["cornmeal", "malai"], ["polenta", "malai"], ["semolina", "gris"],
  ["oat", "fulgi-ovaz"], ["rolled oat", "fulgi-ovaz"], ["oatmeal", "fulgi-ovaz"],
  ["rice", "orez"], ["rice noodle", null], ["rice wine", null], ["arborio rice", "orez-bob-rotund"], ["risotto rice", "orez-bob-rotund"],
  ["spaghetti", "paste-spaghete"], ["penne", "paste-penne"], ["fusilli", "paste-fusilli"],
  ["egg noodle", "taitei-supa"], ["noodle", "taitei-supa"], ["lasagna noodle", "lasagna-foi"], ["lasagna sheet", "lasagna-foi"],
  ["couscous", "couscous"], ["bulgur", "bulgur"], ["quinoa", "quinoa"],
  ["lentil", "linte"], ["chickpea", "naut"], ["garbanzo bean", "naut"], ["split pea", "mazare-uscata"], ["pearl barley", "arpacas"], ["barley", "arpacas"],
  ["bread", "paine-alba"], ["breadcrumb", "pesmet"], ["bread crumb", "pesmet"], ["panko", "pesmet"], ["tortilla", "lipie"], ["pizza dough", "blat-pizza"],
  ["phyllo", "foi-placinta"], ["filo", "foi-placinta"], ["phyllo dough", "foi-placinta"], ["puff pastry", "aluat-foietaj"],

  // Copt și dulciuri
  ["sugar", "zahar"], ["granulated sugar", "zahar"], ["white sugar", "zahar"], ["caster sugar", "zahar"],
  ["brown sugar", null], ["maple syrup", null], ["corn syrup", null],
  ["powdered sugar", "zahar-pudra"], ["icing sugar", "zahar-pudra"], ["confectioners sugar", "zahar-pudra"], ["vanilla sugar", "zahar-vanilat"],
  ["yeast", "drojdie-uscata"], ["dry yeast", "drojdie-uscata"], ["active dry yeast", "drojdie-uscata"], ["instant yeast", "drojdie-uscata"], ["fresh yeast", "drojdie-proaspata"],
  ["baking powder", "praf-copt"], ["baking soda", "bicarbonat"], ["bicarbonate of soda", "bicarbonat"], ["cream of tartar", null],
  ["cocoa", "cacao"], ["cocoa powder", "cacao"],
  ["chocolate chip", null], ["dark chocolate", "ciocolata-gatit"], ["semisweet chocolate", "ciocolata-gatit"], ["baking chocolate", "ciocolata-gatit"],
  ["vanilla", "esenta-vanilie"], ["vanilla extract", "esenta-vanilie"], ["rum extract", "esenta-rom"],
  ["vanilla bean", null], ["vanilla yogurt", null], ["vanilla ice cream", null], ["almond extract", null],
  ["walnut", "nuci-miez"], ["hazelnut", "alune"], ["almond", "migdale"], ["raisin", "stafide"],
  ["condensed milk", "lapte-condensat"], ["sweetened condensed milk", "lapte-condensat"],
  ["gelatin", "gelatina"], ["cornstarch", "amidon"], ["corn starch", "amidon"], ["cornflour", "amidon"],
  ["sunflower seed", "seminte-floarea-soarelui"], ["pumpkin seed", "seminte-dovleac"], ["sesame", "susan"], ["sesame seed", "susan"], ["poppy seed", "mac"],
  ["honey", "miere"], ["jam", "gem"], ["milk chocolate", null], ["evaporated milk", null], ["powdered milk", null],

  // Conserve, sosuri, uleiuri
  ["tomato paste", "pasta-tomate"], ["tomato sauce", "bulion"], ["tomato puree", "bulion"], ["passata", "bulion"],
  ["tomato juice", null], ["sun dried tomato", null], ["tomato ketchup", "ketchup"],
  ["canned tomato", "rosii-conserva"], ["diced tomato", "rosii-conserva"], ["crushed tomato", "rosii-conserva"], ["peeled tomato", "rosii-conserva"],
  ["pickle", "castraveti-murati"], ["dill pickle", "castraveti-murati"], ["sauerkraut", "varza-murata"],
  ["kidney bean", "fasole-conserva"], ["white bean", "fasole-conserva"], ["cannellini bean", "fasole-conserva"], ["black bean", "fasole-conserva"],
  ["tuna", "ton-conserva"], ["canned tuna", "ton-conserva"], ["sardine", "sardine-conserva"],
  ["olive", "masline"], ["black olive", "masline"], ["caper", "capere"],
  ["ketchup", "ketchup"], ["mayonnaise", "maioneza"], ["mayo", "maioneza"], ["mustard", "mustar"], ["dijon mustard", "mustar"], ["horseradish", "hrean"],
  ["soy sauce", "sos-soia"], ["chili sauce", null], ["cream of mushroom", null], ["cream of chicken", null],
  ["oil", "ulei-floarea-soarelui"], ["vegetable oil", "ulei-floarea-soarelui"], ["sunflower oil", "ulei-floarea-soarelui"], ["canola oil", "ulei-floarea-soarelui"],
  ["olive oil", "ulei-masline"], ["extra virgin olive oil", "ulei-masline"],
  ["sesame oil", null], ["coconut oil", null], ["peanut oil", null], ["walnut oil", null], ["avocado oil", null], ["corn oil", null],
  ["vinegar", "otet"], ["white vinegar", "otet"], ["white wine vinegar", "otet"], ["red wine vinegar", "otet"], ["balsamic vinegar", null], ["rice vinegar", null], ["apple cider vinegar", "otet-mere"], ["cider vinegar", "otet-mere"],
  ["chicken stock", null], ["chicken broth", null], ["beef stock", null], ["beef broth", null], ["vegetable stock", null], ["vegetable broth", null],
  ["chicken bouillon", null], ["bouillon cube", "cub-supa"], ["stock cube", "cub-supa"],

  // Condimente și verdețuri
  ["salt", "sare"], ["kosher salt", "sare"], ["sea salt", "sare"], ["table salt", "sare"],
  ["pepper", "piper-negru-macinat"], ["black pepper", "piper-negru-macinat"], ["ground black pepper", "piper-negru-macinat"], ["peppercorn", "piper-boabe"],
  ["paprika", "boia-dulce"], ["sweet paprika", "boia-dulce"], ["smoked paprika", "boia-afumata"], ["hot paprika", "boia-iute"],
  ["cayenne", "boia-iute"], ["cayenne pepper", "boia-iute"], ["chili powder", "boia-iute"],
  ["red pepper flake", "ardei-iute-uscat"], ["chili flake", "ardei-iute-uscat"],
  ["garlic powder", null], ["onion powder", null], ["lemon pepper", null], ["garlic salt", null], ["onion salt", null], ["celery salt", null],
  ["thyme", "cimbru-proaspat"], ["fresh thyme", "cimbru-proaspat"], ["dried thyme", "cimbru-uscat"],
  ["oregano", "oregano"], ["dried oregano", "oregano"],
  ["basil", "busuioc-proaspat"], ["fresh basil", "busuioc-proaspat"], ["dried basil", "busuioc-uscat"],
  ["bay leaf", "dafin"], ["caraway", "chimen"], ["fresh coriander", null], ["cilantro", null], ["caraway seed", "chimen"], ["coriander", "coriandru"], ["ground coriander", "coriandru"],
  ["cinnamon", "scortisoara"], ["cinnamon stick", "scortisoara"], ["clove", "cuisoare"], ["nutmeg", "nucsoara"], ["allspice", "ienibahar"],
  ["curry", "curry"], ["curry powder", "curry"],
  ["tarragon", "tarhon-proaspat"], ["dill", "marar"], ["fresh dill", "marar"], ["dried dill", "marar-uscat"], ["lovage", "leustean"],
  ["parsley", "patrunjel-verde"], ["fresh parsley", "patrunjel-verde"], ["flat leaf parsley", "patrunjel-verde"],
  ["mint", "menta-proaspata"], ["rosemary", "rozmarin-proaspat"], ["sage", "salvie-proaspata"],

  // Carne și pește
  ["chicken", "pui-intreg"], ["whole chicken", "pui-intreg"], ["chicken breast", "piept-pui"], ["chicken thigh", "pulpe-pui"], ["chicken leg", "pulpe-pui"], ["chicken drumstick", "pulpe-pui"],
  ["chicken wing", "aripi-pui"], ["chicken liver", "ficat-pui"], ["chicken noodle", null], ["chicken sausage", null], ["chicken tender", null],
  ["ground beef", "carne-tocata-vita"], ["minced beef", "carne-tocata-vita"], ["beef mince", "carne-tocata-vita"],
  ["ground pork", "carne-tocata-porc"], ["minced pork", "carne-tocata-porc"], ["ground chicken", "carne-tocata-pui"], ["ground turkey", null],
  ["pork chop", "cotlet-porc"], ["pork tenderloin", "muschi-porc"], ["pork loin", null], ["pork shoulder", "spata-porc"], ["pork belly", "piept-porc"],
  ["pork rib", "coaste-porc"], ["spare rib", "coaste-porc"], ["baby back rib", "coaste-porc"],
  ["beef tenderloin", "muschi-vita"], ["lamb", "carne-miel"], ["leg of lamb", "pulpa-miel"], ["lamb leg", "pulpa-miel"],
  ["turkey breast", "piept-curcan"], ["duck", "rata"], ["rabbit", "iepure"],
  ["sausage", "carnati-proaspeti"], ["smoked sausage", "carnati-afumati"], ["bacon", "bacon"], ["ham", "sunca-presata"],
  ["salmon", "somon-file"], ["salmon fillet", "somon-file"], ["cod", "file-cod"], ["cod fillet", "file-cod"], ["trout", "pastrav"], ["mackerel", "macrou"],
  ["fresh tuna", "ton-proaspat"], ["tuna steak", "ton-proaspat"],
  ["shrimp", "creveti"], ["prawn", "creveti"], ["mussel", "midii"], ["squid", "calamar"], ["calamari", "calamar"],

  // Lactate și ouă
  ["milk", "lapte-integral"], ["whole milk", "lapte-integral"], ["skim milk", "lapte-semidegresat"], ["low fat milk", "lapte-semidegresat"],
  ["coconut milk", null], ["almond milk", "lapte-vegetal"], ["oat milk", "lapte-vegetal"], ["soy milk", "lapte-vegetal"], ["cashew milk", "lapte-vegetal"], ["rice milk", "lapte-vegetal"],
  ["buttermilk", "lapte-batut"], ["kefir", "kefir"],
  ["yogurt", "iaurt-natural"], ["plain yogurt", "iaurt-natural"], ["greek yogurt", "iaurt-grecesc"],
  ["sour cream", "smantana"], ["heavy cream", "smantana-dulce"], ["whipping cream", "smantana-dulce"], ["heavy whipping cream", "smantana-dulce"], ["double cream", "smantana-dulce"],
  ["butter", "unt"], ["unsalted butter", "unt"], ["salted butter", "unt"], ["peanut butter", null], ["almond butter", null], ["cashew butter", null], ["cocoa butter", null], ["apple butter", null], ["butter bean", null],
  ["cottage cheese", "branza-cottage"], ["cream cheese", "crema-branza"], ["mascarpone", "mascarpone"], ["ricotta", "ricotta"], ["mozzarella", "mozzarella"],
  ["parmesan", "parmezan"], ["parmigiano reggiano", "parmezan"], ["feta", "feta"], ["goat cheese", "branza-capra"], ["gouda", "gouda"], ["halloumi", "halloumi"],
  ["egg", "oua"], ["egg yolk", "oua"], ["egg white", "oua"], ["quail egg", "oua-prepelita"],

  // Legume
  ["tomato", "rosii"], ["cherry tomato", "rosii-cherry"], ["grape tomato", "rosii-cherry"], ["cucumber", "castraveti"],
  ["potato", "cartofi-albi"], ["russet potato", "cartofi-albi"], ["yukon gold potato", "cartofi-albi"], ["red potato", "cartofi-rosii"], ["new potato", "cartofi-noi"], ["baby potato", "cartofi-noi"],
  ["sweet potato", "cartofi-dulci"],
  ["onion", "ceapa-galbena"], ["yellow onion", "ceapa-galbena"], ["white onion", "ceapa-galbena"], ["red onion", "ceapa-rosie"],
  ["green onion", "ceapa-verde"], ["scallion", "ceapa-verde"], ["spring onion", "ceapa-verde"], ["shallot", "ceapa-saloata"],
  ["garlic", "usturoi"], ["garlic clove", "usturoi"], ["garlic bread", null],
  ["carrot", "morcovi"], ["parsnip", "pastarnac"], ["celery", "telina-apio"], ["celery stalk", "telina-apio"], ["celery root", "telina-radacina"], ["celeriac", "telina-radacina"],
  ["bell pepper", "ardei-gras"], ["green pepper", "ardei-gras"], ["red pepper", "ardei-gras"], ["yellow pepper", "ardei-gras"], ["orange pepper", "ardei-gras"], ["pepper jack", null], ["red bell pepper", "ardei-gras"], ["green bell pepper", "ardei-gras"], ["sweet pepper", "ardei-gras"],
  ["jalapeno", "ardei-iute"], ["chili pepper", "ardei-iute"], ["hot pepper", "ardei-iute"], ["chili", "ardei-iute"],
  ["eggplant", "vinete"], ["aubergine", "vinete"], ["zucchini", "dovlecei"], ["courgette", "dovlecei"],
  ["green bean", "fasole-verde"], ["pea", "mazare-verde"], ["green pea", "mazare-verde"], ["frozen pea", "mazare-congelata"],
  ["cabbage", "varza-alba"], ["white cabbage", "varza-alba"], ["green cabbage", "varza-alba"], ["red cabbage", "varza-rosie"],
  ["cauliflower", "conopida"], ["broccoli", "broccoli"], ["lettuce", "salata-verde"], ["spinach", "spanac"], ["baby spinach", "spanac"], ["frozen spinach", "spanac-congelat"],
  ["leek", "praz"], ["beet", "sfecla-rosie"], ["beetroot", "sfecla-rosie"], ["radish", "ridichi"], ["turnip", "napi"],
  ["pumpkin", "dovleac"], ["butternut squash", "dovleac"],
  ["corn", "porumb-conserva"], ["corn tortilla", null], ["corn flour", null], ["sweet corn", "porumb-conserva"], ["corn on the cob", "porumb-stiuleti"],
  ["mushroom", "ciuperci-champignon"], ["button mushroom", "ciuperci-champignon"], ["white mushroom", "ciuperci-champignon"], ["cremini mushroom", "ciuperci-champignon"],
  ["oyster mushroom", "pleurotus"], ["porcini", "hribi"], ["shiitake", "ciuperci-shiitake"],
  ["ginger", "ghimbir"], ["fresh ginger", "ghimbir"], ["ginger ale", null],
  ["asparagus", "sparanghel"], ["arugula", "rucola"], ["rocket", "rucola"], ["kale", "kale"], ["brussels sprout", "varza-de-bruxelles"], ["avocado", "avocado"],

  // Fructe
  ["lemon", "lamai"], ["lemon juice", "lamai"], ["lemon zest", "lamai"], ["lime", "lime"], ["lime juice", "lime"],
  ["orange", "portocale"], ["orange juice", "suc-portocale"], ["apple", "mere"], ["green apple", "mere-verzi"], ["granny smith apple", "mere-verzi"], ["apple juice", "suc-mere"],
  ["banana", "banane"], ["pear", "pere"], ["plum", "prune"], ["grape", "struguri"], ["cherry", "cirese"], ["sour cherry", "visine"],
  ["strawberry", "capsuni"], ["blueberry", "afine"], ["raspberry", "zmeura"], ["blackberry", "mure"], ["apricot", "caise"], ["peach", "piersici"],
  ["watermelon", "pepene-rosu"], ["fig", "smochine"], ["kiwi", "kiwi"], ["pineapple", "ananas"], ["mango", "mango"], ["pomegranate", "rodii"], ["rhubarb", "rubarba"],

  // Băuturi
  ["water", "apa-plata"], ["sparkling water", "apa-minerala"], ["coconut water", null], ["rose water", null], ["orange blossom water", null], ["water chestnut", null], ["white wine", "vin-alb"], ["dry white wine", "vin-alb"], ["red wine", "vin-rosu"], ["beer", "bere"],
];
