import type { RecipeSeed } from "../seed-types";
import { SUPE_MIC_DEJUN } from "./supe-mic-dejun";
import { TRADITIONALE } from "./traditionale";
import { PESTE_SALATE_LEGUME } from "./peste-salate-legume";
import { INTERNATIONALE_DESERTURI } from "./internationale-deserturi";
import { USOARE_MIC_DEJUN_GUSTARI } from "./usoare-mic-dejun-gustari";
import { USOARE_SUPE_LEGUME } from "./usoare-supe-legume";
import { USOARE_CARNE_PESTE } from "./usoare-carne-peste";
import { USOARE_PASTE_DESERTURI } from "./usoare-paste-deserturi";

export const RECIPE_SEEDS: RecipeSeed[] = [
  ...SUPE_MIC_DEJUN,
  ...TRADITIONALE,
  ...PESTE_SALATE_LEGUME,
  ...INTERNATIONALE_DESERTURI,
  ...USOARE_MIC_DEJUN_GUSTARI,
  ...USOARE_SUPE_LEGUME,
  ...USOARE_CARNE_PESTE,
  ...USOARE_PASTE_DESERTURI,
];
