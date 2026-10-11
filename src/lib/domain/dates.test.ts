import { describe, expect, it } from "vitest";
import { addDays, endOfMonth, monthPeriod, startOfWeek, weekPeriod } from "./dates";

describe("date", () => {
  it("săptămâna începe luni", () => {
    expect(startOfWeek("2026-10-11")).toBe("2026-10-05"); // duminică
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(weekPeriod("2026-10-07")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });

  it("calculează luna și trecerea la ora de vară", () => {
    expect(endOfMonth("2026-02-10")).toBe("2026-02-28");
    expect(monthPeriod("2028-02-03")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });
});
