// @vitest-environment jsdom
import { beforeEach, expect, it } from "vitest";
import { getTheme, setTheme, THEME_BOOTSTRAP, THEME_COLORS } from "./theme";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
  document.head.innerHTML = Object.entries(THEME_COLORS).map(([theme, color]) =>
    `<meta name="theme-color" data-camara-theme="${theme}" content="${color}">`
  ).join("");
});

function browserColors() {
  return [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(tag => tag.content);
}

it("restores the selected color before hydration and restores both system colors on reset", () => {
  localStorage.setItem("camara-tema", "intunecat");
  new Function(THEME_BOOTSTRAP)();
  expect(document.documentElement.dataset.theme).toBe("intunecat");
  expect(browserColors()).toEqual([THEME_COLORS.intunecat, THEME_COLORS.luminos, THEME_COLORS.intunecat]);

  setTheme("luminos");
  expect(getTheme()).toBe("luminos");
  expect(document.documentElement.dataset.theme).toBe("luminos");
  expect(browserColors()).toEqual([THEME_COLORS.luminos, THEME_COLORS.luminos, THEME_COLORS.intunecat]);

  setTheme("sistem");
  expect(getTheme()).toBe("sistem");
  expect(document.documentElement.dataset.theme).toBeUndefined();
  expect(browserColors()).toEqual([THEME_COLORS.luminos, THEME_COLORS.intunecat]);
});
