# Etapa 2c: genereaza imaginile AI prin Pollinations (FLUX, gratuit, fara cheie).
# Rulare: python3 -I .tasks/008-genereaza-imagini.py <director-iesire>
# Necesita image.pollinations.ai in Allowed domains (sesiune pornita dupa setare).
import sys, urllib.parse, urllib.request, pathlib, time
STYLE = " 45-degree angle, natural window light, light wooden table, simple white ceramic plate. Realistic food photography. No text, no people, no hands."
P = {
 "varza-calita-cu-carne": "Romanian braised shredded white cabbage (sauerkraut-style, thin pale yellow-red cabbage strands, clearly cabbage not pasta) stewed with tomato and paprika, with tender chunks of pork, sprinkled with dill.",
 "macrou-la-cuptor": "Whole oven-baked mackerel with golden browned striped skin on roasted onion rings and tomato slices, with lemon slices and chopped parsley.",
 "salata-greceasca": "Greek salad: chunks of tomato, cucumber, green bell pepper, red onion rings, black olives, topped with one large block of feta sprinkled with oregano, drizzled with olive oil.",
 "cartofi-taranesti": "Rustic pan-roasted potato wedges, golden and crispy with paprika, sautéed onion slices, garlic and thyme, sprinkled with chopped parsley.",
 "fasole-batuta": "Romanian fasole batuta: smooth creamy pale white bean puree spread on a plate, topped with caramelized reddish-brown fried onions with paprika, pickles on the side.",
 "ciuperci-cu-smantana": "Sliced champignon mushrooms in creamy sour cream sauce with onion and dill, served over soft yellow polenta.",
 "curry-de-pui": "Chicken curry: chunks of chicken in creamy orange tomato curry sauce, next to fluffy white rice, sprinkled with parsley.",
 "ciorba-de-pui": "Romanian chicken sour soup a la grec in a bowl: creamy pale yellow broth thickened with egg and lemon, shredded chicken, rice, carrot, dill, lemon slice beside the bowl.",
 "ciorba-de-fasole-cu-afumatura": "Thick Romanian bean soup in a bowl: white beans in reddish broth with paprika, chunks of smoked pork ribs, carrot, bell pepper, lovage on top.",
 "omleta-cu-legume": "Fluffy folded vegetable omelette with bell pepper, tomato, mushrooms, green onion and melted cheese, parsley on top.",
 "salata-de-oua": "Egg salad made of chopped boiled eggs with yogurt and mustard, green onion, diced pickles and dill, with slices of wholegrain bread.",
 "tocanita-de-porc": "Romanian pork stew: tender pork chunks in thick red tomato-paprika onion sauce, served with a mound of yellow polenta, parsley on top.",
 "chiftele-de-porc-vita": "Romanian chiftele: round flattened fried meatballs, crispy golden-brown crust, served with mashed potatoes and parsley.",
 "pui-la-cuptor-cu-cartofi": "Oven-roasted chicken legs with crispy golden paprika skin on a bed of roasted potato chunks with garlic and onion, in a baking dish.",
 "iahnie-de-fasole": "Romanian iahnie de fasole: white beans in thick orange sauce of caramelized onion, tomato and paprika, bay leaf, parsley on top, in a bowl.",
 "salata-de-vinete": "Romanian eggplant spread (salata de vinete): smooth pale beige-green roasted eggplant dip with finely chopped onion, tomato slices beside it, bread on the side.",
 "salata-orientala": "Romanian oriental potato salad: boiled potato chunks, sliced red onion, quartered boiled eggs, black olives, parsley, glistening with oil.",
 "dovlecei-pane": "Breaded zucchini slices fried golden and crispy, with a small bowl of garlic yogurt sauce.",
 "mancare-de-spanac": "Romanian spinach stew: smooth dark green creamed spinach with garlic, a dollop of sour cream, a fried egg on the side.",
 "linte-cu-legume": "Brown lentil stew with carrot, celery and onion in tomato sauce, bay leaf, in a bowl.",
 "salata-de-fructe": "Fresh fruit salad in a bowl: diced apple, banana, orange, kiwi, grapes, a spoon of yogurt and fresh mint leaves.",
 "placinta-cu-branza": "Romanian sweet cheese pie: squares of golden flaky phyllo pastry baked in a tray, cut to show sweet cottage cheese filling with raisins, dusted with powdered sugar.",
 "pilaf-de-pui": "Romanian chicken pilaf: rice cooked with golden browned chicken pieces, carrot and bell pepper, paprika tint, parsley on top.",
 "tocana-de-cartofi": "Romanian potato stew: potato chunks in red tomato-paprika onion sauce, bay leaf, parsley on top, in a bowl.",
 "paste-cu-ton-si-rosii": "Penne pasta with tomato sauce, flakes of tuna, black olives and capers, parsley on top.",
 "mancare-de-mazare-cu-pui": "Romanian green pea stew with chunks of chicken breast, carrot rounds, light tomato sauce, plenty of dill.",
 "mici-la-gratar": "Romanian mici: several short skinless grilled minced-meat rolls (no casing, rough textured surface, grill marks), with a dollop of yellow mustard and slices of white bread.",
 "papanasi": "Two Romanian papanasi: golden fried cheese doughnuts, each a large ring with a small ball on top, covered with sour cream and dark cherry jam.",
}
out = pathlib.Path(sys.argv[1]); out.mkdir(exist_ok=True)
for k, v in P.items():
    f = out / f"{k}.jpg"
    if f.exists(): continue
    url = "https://image.pollinations.ai/prompt/" + urllib.parse.quote(v + STYLE) + "?width=1280&height=960&nologo=true&model=flux&seed=7"
    for attempt in range(3):
        try:
            data = urllib.request.urlopen(url, timeout=180).read()
            f.write_bytes(data); print("ok", k, len(data)); break
        except Exception as e:
            print("err", k, e); time.sleep(10)
