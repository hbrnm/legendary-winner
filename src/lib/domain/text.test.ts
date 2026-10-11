import { describe, expect, it } from "vitest";
import { capitalizeFirst, count } from "./text";

describe("texte", () => {
  it("acordă numeralul ca în română", () => {
    expect(count(1, "produs", "produse")).toBe("1 produs");
    expect(count(2, "produs", "produse")).toBe("2 produse");
    expect(count(19, "produs", "produse")).toBe("19 produse");
    expect(count(20, "produs", "produse")).toBe("20 de produse");
    expect(count(101, "produs", "produse")).toBe("101 produse");
    expect(count(120, "produs", "produse")).toBe("120 de produse");
    expect(count(0, "produs", "produse")).toBe("0 produse");
  });

  it("face doar prima literă mare", () => {
    expect(capitalizeFirst("duminică, 11 octombrie")).toBe("Duminică, 11 octombrie");
  });
});
