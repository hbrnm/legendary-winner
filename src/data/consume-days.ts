// După câte zile se consideră consumat un produs intrat în cămară din
// cumpărături, pe categorii (decizia proprietarului, chestionar, 22 oct. 2026,
// .tasks/016). Categoriile nealimentare nu intră în cămară, deci lipsesc.
export const CONSUME_DAYS: Record<string, number> = {
  panificatie: 3,
  fructe: 5,
  legume: 5,
  carne: 5,
  peste: 5,
  lactate: 7,
  oua: 7,
  mezeluri: 7,
  copii: 7,
  branzeturi: 14,
  "dulciuri-gustari": 30,
  bauturi: 30,
  congelate: 60,
  "cereale-paste": 90,
  copt: 90,
  conserve: 90,
  "uleiuri-condimente": 120,
};
