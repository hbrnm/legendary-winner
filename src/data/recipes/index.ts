import type { RecipeSeed } from "../seed-types";
import { SUPE_MIC_DEJUN } from "./supe-mic-dejun";
import { TRADITIONALE } from "./traditionale";
import { PESTE_SALATE_LEGUME } from "./peste-salate-legume";
import { INTERNATIONALE_DESERTURI } from "./internationale-deserturi";

export const RECIPE_SEEDS: RecipeSeed[] = [...SUPE_MIC_DEJUN, ...TRADITIONALE, ...PESTE_SALATE_LEGUME, ...INTERNATIONALE_DESERTURI];
