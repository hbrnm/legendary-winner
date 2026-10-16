import { describe, expect, it } from "vitest";
import { FUNCTIONS, bundle, current } from "./build-functions.mjs";

describe("funcțiile Edge împachetate", () => {
  it("core.js din repo e la zi cu src/lib/server (altfel: npm run build:functions)", async () => {
    for (const f of FUNCTIONS as { entry: string; out: string }[]) expect(current(f.out), f.out).toBe(await bundle(f.entry));
  });
});
