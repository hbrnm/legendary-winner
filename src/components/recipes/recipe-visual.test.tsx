// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { RecipeVisual } from "./recipe-visual";

describe("RecipeVisual", () => {
  it("fără fotografie nu afișează nimic (fără pătrățele cu pictograme)", () => {
    const { container } = render(<RecipeVisual recipe={{ image_url: null }} />);
    expect(container.innerHTML).toBe("");
  });

  it("cu fotografie, afișează fotografia", () => {
    const { container } = render(<RecipeVisual recipe={{ image_url: "https://exemplu.ro/ciorba.jpg" }} size="lg" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://exemplu.ro/ciorba.jpg");
  });
});
