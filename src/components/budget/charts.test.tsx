// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ColumnChart } from "./charts";
import { DualBudgetBar } from "@/components/ui/misc";

const bars = (values: number[]) => values.map((value, i) => ({ key: String(i), label: `l${i}`, value }));

describe("ColumnChart", () => {
  it("fără nicio cheltuială nu rămâne gol: arată schița estompată și explicația", () => {
    const { container, getByText } = render(<ColumnChart bars={bars([0, 0, 0])} title="Cheltuieli pe lună" />);
    expect(getByText("Graficul se umple după primele cumpărături.")).toBeTruthy();
    expect(container.querySelectorAll("path")).toHaveLength(3);
  });

  it("cu cheltuieli, desenează coloanele", () => {
    const { container } = render(<ColumnChart bars={bars([10, 0, 30])} title="Cheltuieli pe lună" />);
    expect(container.textContent).not.toContain("Graficul se umple");
    expect(container.querySelector("svg")?.getAttribute("aria-label")).toContain("Cheltuieli pe lună");
  });
});

describe("DualBudgetBar", () => {
  it("verde pentru cheltuit, galben pentru coș, proporțional cu bugetul", () => {
    const { container, getByRole } = render(<DualBudgetBar spent={1000} pending={250} total={2500} label="Buget" />);
    const spent = container.querySelector<HTMLElement>("[data-part=cheltuit]")!;
    const cart = container.querySelector<HTMLElement>("[data-part=cos]")!;
    expect(spent.className).toContain("bg-brand");
    expect(cart.className).toContain("bg-warn");
    expect(spent.style.width).toBe("40%");
    expect(cart.style.width).toBe("10%");
    expect(getByRole("progressbar").getAttribute("aria-valuenow")).toBe("50");
  });

  it("peste buget, cheltuiala devine roșie și bara se scalează la total", () => {
    const { container } = render(<DualBudgetBar spent={3000} pending={1000} total={2000} label="Buget" />);
    const spent = container.querySelector<HTMLElement>("[data-part=cheltuit]")!;
    expect(spent.className).toContain("bg-accent");
    expect(spent.style.width).toBe("75%");
  });
});
