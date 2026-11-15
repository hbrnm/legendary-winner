import { describe, expect, it } from "vitest";
import { resolveAppMode, DEMO_MODE_KEY } from "./app-mode";

function storage(values: Record<string, string> = {}) {
  const data = new Map(Object.entries(values));
  return { data, getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
}

describe("alegerea modului demonstrativ", () => {
  it("cu Supabase configurat, cere cont dacă demo nu a fost ales", () => {
    expect(resolveAppMode(true, "", storage())).toBe("cloud");
  });
  it("intrarea explicită pornește demo și îl păstrează după reîncărcare", () => {
    const local = storage();
    expect(resolveAppMode(true, "?demo=1", local)).toBe("demo");
    expect(resolveAppMode(true, "?id=reteta", local)).toBe("demo");
  });
  it("ieșirea revine la cont fără să șteargă sesiunea utilizatorului", () => {
    const local = storage({ [DEMO_MODE_KEY]: "1", "sb-test-auth-token": "existing-session", "camara-tema": "intunecat" });
    expect(resolveAppMode(true, "?demo=0", local)).toBe("cloud");
    expect(resolveAppMode(true, "", local)).toBe("cloud");
    expect(local.data.get("sb-test-auth-token")).toBe("existing-session");
    expect(local.data.get("camara-tema")).toBe("intunecat");
  });
  it("linkul de ieșire are prioritate față de preferința demo salvată", () => {
    expect(resolveAppMode(true, "?demo=0&inapoi=%2Fplan%2F", storage({ [DEMO_MODE_KEY]: "1" }))).toBe("cloud");
  });
  it("fără acces la stocarea preferințelor, linkul demo funcționează", () => {
    const blocked = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
    expect(resolveAppMode(true, "?demo=1", blocked)).toBe("demo");
    expect(resolveAppMode(true, "?demo=0", blocked)).toBe("cloud");
    expect(resolveAppMode(true, "", blocked)).toBe("cloud");
    expect(resolveAppMode(true, "?demo=1", null)).toBe("demo");
  });
  it("fără Supabase, aplicația rămâne demonstrativă", () => {
    expect(resolveAppMode(false, "?demo=0", storage())).toBe("demo");
  });
  it("parametrii necunoscuți nu activează demo", () => {
    expect(resolveAppMode(true, "?demo=yes", storage())).toBe("cloud");
  });
  it("citirea modului pentru hidratare nu modifică stocarea", () => {
    const local = storage();
    expect(resolveAppMode(true, "?demo=1", local, false)).toBe("demo");
    expect(local.data.has(DEMO_MODE_KEY)).toBe(false);
  });
});
