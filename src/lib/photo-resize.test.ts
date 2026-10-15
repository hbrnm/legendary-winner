import { describe, expect, it } from "vitest";
import { PHOTO_TARGET_BYTES, pickEncoding } from "./photo-resize";
import { RECIPE_PHOTO_MAX_BYTES } from "@/lib/services/recipe-photos";

describe("alegerea calității la micșorare", () => {
  it("ia prima variantă sub țintă", () => {
    expect(pickEncoding([{ size: 400_000 }, { size: 180_000 }, { size: 120_000 }])).toEqual({ size: 180_000 });
  });
  it("altfel, cea mai mică, dacă încape în limita de pe server", () => {
    expect(pickEncoding([{ size: 900_000 }, { size: PHOTO_TARGET_BYTES + 1 }])).toEqual({ size: PHOTO_TARGET_BYTES + 1 });
    expect(pickEncoding([{ size: RECIPE_PHOTO_MAX_BYTES + 1 }])).toBeNull();
    expect(pickEncoding([{ size: 0 }])).toBeNull();
    expect(pickEncoding([])).toBeNull();
  });
});
