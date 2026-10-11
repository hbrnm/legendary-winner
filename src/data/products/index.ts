import type { ProductSeed } from "../seed-types";
import { PROASPETE } from "./proaspete";
import { CARNE_LACTATE } from "./carne-lactate";
import { BACANIE } from "./bacanie";
import { ALTELE } from "./altele";

export const PRODUCT_SEEDS: ProductSeed[] = [...PROASPETE, ...CARNE_LACTATE, ...BACANIE, ...ALTELE];
