// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { UpdateBanner } from "./service-worker";

describe("mesajul pentru versiunea nouă", () => {
  it("spune ce s-a întâmplat și lasă omul să aleagă când reîncarcă", () => {
    const onReload = vi.fn();
    const onLater = vi.fn();
    render(<UpdateBanner onReload={onReload} onLater={onLater} />);
    expect(screen.getByRole("status").textContent).toContain("Am adus o versiune nouă a Cămării.");
    fireEvent.click(screen.getByRole("button", { name: "Reîncarcă" }));
    expect(onReload).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Mai târziu" }));
    expect(onLater).toHaveBeenCalledTimes(1);
  });
});
