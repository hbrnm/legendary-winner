// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { BarList, ColumnChart } from "./charts";
import { DualBudgetBar } from "@/components/ui/misc";

const bars = (values: number[]) => values.map((value, i) => ({ key: String(i), label: `l${i}`, value }));

afterEach(cleanup);

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
  it("verde pentru cheltuit, auriu pentru coș, proporțional cu bugetul", () => {
    const { container, getByRole } = render(<DualBudgetBar spent={1000} pending={250} total={2500} label="Buget" />);
    const spent = container.querySelector<HTMLElement>("[data-part=cheltuit]")!;
    const cart = container.querySelector<HTMLElement>("[data-part=cos]")!;
    expect(spent.className).toContain("bg-secondary");
    expect(cart.className).toContain("bg-tertiary");
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


describe("BarList", () => {
  it("folosește totalul pentru lățimea barei și afișează ponderile pozitive sub 1%", () => {
    const { container, getByText } = render(<BarList bars={bars([37, 0.5])} total={100} />);
    const fills = container.querySelectorAll<HTMLElement>("li > div:last-child > div");
    expect(fills[0].style.width).toBe("37%");
    expect(fills[1].style.width).toBe("0.5%");
    expect(getByText("· <1%")).toBeTruthy();
  });
  it("cu onSelect, fiecare bară e un buton care deschide detaliile categoriei", () => {
    const onSelect = vi.fn();
    const { getByRole, getAllByRole } = render(<BarList bars={bars([20, 30])} total={50} onSelect={onSelect} />);
    const button = getByRole("button", { name: "Vezi cheltuielile din l1" });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith("1");
    expect(getAllByRole("button")).toHaveLength(2);
  });

  it("fără onSelect, barele rămân text simplu, fără butoane", () => {
    const { queryByRole } = render(<BarList bars={bars([20])} total={20} />);
    expect(queryByRole("button")).toBeNull();
  });

  it("keeps negative unallocated adjustments visible without a negative CSS width", () => {
    const { container, getByText } = render(<BarList bars={[{ key: "food", label: "Alimentație", value: 20 }, { key: "other", label: "Alte cheltuieli", value: -8 }]} total={12} />);
    expect(getByText("Alte cheltuieli")).toBeTruthy();
    const bars = container.querySelectorAll<HTMLElement>("li > div:last-child > div");
    expect(bars[1].style.width).toBe("0%");
    expect(container.textContent).toContain("-8");
  });
});
