// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Segmented } from "./fields";

afterEach(() => cleanup());

function TestSegmented({ onChange }: { onChange?: (v: string) => void }) {
  const [val, setVal] = useState("a");
  const options = [
    { value: "a", label: "Opțiunea A" },
    { value: "b", label: "Opțiunea B" },
    { value: "c", label: "Opțiunea C" },
  ];
  return (
    <Segmented
      label="Alege"
      value={val}
      options={options}
      onChange={(v) => {
        setVal(v);
        onChange?.(v);
      }}
    />
  );
}

describe("Segmented - navigare tastatură WAI-ARIA radio group (F13)", () => {
  it("atribuie tabIndex 0 opțiunii selectate și -1 celor neselectate", () => {
    render(<TestSegmented />);
    const btnA = screen.getByRole("radio", { name: "Opțiunea A" });
    const btnB = screen.getByRole("radio", { name: "Opțiunea B" });
    const btnC = screen.getByRole("radio", { name: "Opțiunea C" });

    expect(btnA.getAttribute("tabindex")).toBe("0");
    expect(btnB.getAttribute("tabindex")).toBe("-1");
    expect(btnC.getAttribute("tabindex")).toBe("-1");
  });

  it("navighează ciclic înainte cu ArrowRight sau ArrowDown", () => {
    const handleChange = vi.fn();
    render(<TestSegmented onChange={handleChange} />);
    const btnA = screen.getByRole("radio", { name: "Opțiunea A" });

    btnA.focus();
    fireEvent.keyDown(btnA, { key: "ArrowRight" });

    expect(handleChange).toHaveBeenCalledWith("b");

    const btnB = screen.getByRole("radio", { name: "Opțiunea B" });
    fireEvent.keyDown(btnB, { key: "ArrowDown" });
    expect(handleChange).toHaveBeenCalledWith("c");

    // Ciclic: de la C la A
    const btnC = screen.getByRole("radio", { name: "Opțiunea C" });
    fireEvent.keyDown(btnC, { key: "ArrowRight" });
    expect(handleChange).toHaveBeenCalledWith("a");
  });

  it("navighează ciclic înapoi cu ArrowLeft sau ArrowUp", () => {
    const handleChange = vi.fn();
    render(<TestSegmented onChange={handleChange} />);
    const btnA = screen.getByRole("radio", { name: "Opțiunea A" });

    btnA.focus();
    // De la A înapoi ciclic la C
    fireEvent.keyDown(btnA, { key: "ArrowLeft" });
    expect(handleChange).toHaveBeenCalledWith("c");
  });
});
