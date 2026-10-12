// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import { Sheet, keyboardInset } from "./sheet";

describe("keyboardInset", () => {
  it("e 0 fără tastatură și înălțimea tastaturii când apare", () => {
    expect(keyboardInset(800, { height: 800, offsetTop: 0 })).toBe(0);
    expect(keyboardInset(800, { height: 460, offsetTop: 0 })).toBe(340);
    // Pagina derulată sub tastatură: partea vizibilă a coborât, tastatura rămâne la fel de înaltă.
    expect(keyboardInset(800, { height: 460, offsetTop: 40 })).toBe(300);
    expect(keyboardInset(800, { height: 900, offsetTop: 0 })).toBe(0);
  });
});

describe("Sheet cu tastatura deschisă", () => {
  it("se ridică deasupra tastaturii și coboară la loc când tastatura dispare", () => {
    const vv = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 });
    Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    const { getByRole } = render(
      <Sheet open onClose={() => {}} title="Prânz">
        <input aria-label="Caută rețeta" />
      </Sheet>,
    );
    const dialog = getByRole("dialog", { hidden: true });
    expect(dialog.style.marginBottom).toBe("");

    act(() => {
      vv.height = 460;
      vv.dispatchEvent(new Event("resize"));
    });
    expect(dialog.style.marginBottom).toBe("340px");
    expect(dialog.style.maxHeight).toBe(`${Math.round(460 * 0.92)}px`);

    act(() => {
      vv.height = 800;
      vv.dispatchEvent(new Event("resize"));
    });
    expect(dialog.style.marginBottom).toBe("");
  });
});
