// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render } from "@testing-library/react";
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

it("focalizează câmpul cerut după deschiderea dialogului, nu butonul de închidere", () => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) { this.open = true; this.querySelector<HTMLButtonElement>("button")?.focus(); };
  const view = render(<Sheet open onClose={() => {}} title="Sumă rapidă"><input aria-label="Suma plătită" data-autofocus /></Sheet>);
  expect(document.activeElement).toBe(view.getByLabelText("Suma plătită"));
});

it("închiderea unui selector imbricat nu închide panoul de captură părinte", () => {
  const outerClose=vi.fn(); const innerClose=vi.fn();
  const view=render(<Sheet open onClose={outerClose} title="Captură bon"><Sheet open onClose={innerClose} title="Alege produsul"><input /></Sheet></Sheet>);
  fireEvent(view.getByRole("dialog",{name:"Alege produsul",hidden:true}),new Event("close"));
  expect(innerClose).toHaveBeenCalledOnce();
  expect(outerClose).not.toHaveBeenCalled();
});
