// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { RecipeAvatar, RecipePhotoCredit, RecipeVisual, hasRecipeVisual, recipeInitial } from "./recipe-visual";

vi.mock("@/data/recipe-photos", async (load) => {
  const real = await load<typeof import("@/data/recipe-photos")>();
  const photos = [
    { recipe_id: "sarmale", file: "sarmale.webp", author: "Ana Pop", source_url: "https://unsplash.com/photos/sarmale-abc", source: "unsplash" as const, license: "Unsplash License", license_url: null },
    { recipe_id: "bulz", file: "bulz.webp", author: "Ion Pop", source_url: "https://commons.wikimedia.org/wiki/File:Bulz.jpg", source: "wikimedia" as const, license: "CC BY-SA 3.0", license_url: "https://creativecommons.org/licenses/by-sa/3.0" },
    { recipe_id: "mici-la-gratar", file: "mici-la-gratar.webp", author: "", source_url: "", source: "ai" as const, license: "", license_url: null },
    { recipe_id: "gris-cu-lapte", file: "gris-cu-lapte.webp", author: "autor necunoscut", source_url: "https://commons.wikimedia.org/wiki/File:Gris.jpg", source: "wikimedia" as const, license: "Public domain", license_url: null },
  ];
  return { ...real, catalogPhotoByUrl: (url: string | null) => photos.find((p) => `/retete/${p.file}` === url) ?? null };
});

describe("RecipeVisual", () => {
  it("fără fotografie nu afișează nimic (fără pătrățele cu pictograme)", () => {
    const { container } = render(<RecipeVisual recipe={{ image_url: null }} />);
    expect(container.innerHTML).toBe("");
  });

  it("o poză din catalog scoasă din listă nu se mai afișează", () => {
    const { container } = render(<RecipeVisual recipe={{ image_url: "/retete/retrasa.webp" }} />);
    expect(container.innerHTML).toBe("");
    expect(render(<RecipeVisual recipe={{ image_url: "/retete/bulz.webp" }} />).container.querySelector("img")).not.toBeNull();
  });

  it("cu fotografie, afișează fotografia", () => {
    const { container } = render(<RecipeVisual recipe={{ image_url: "https://exemplu.ro/ciorba.jpg" }} size="lg" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://exemplu.ro/ciorba.jpg");
  });
});

describe("RecipePhotoCredit", () => {
  it("sub o fotografie din catalog arată autorul și leagă banca de pagina fotografiei", () => {
    const { container, getByRole } = render(<RecipePhotoCredit recipe={{ image_url: "/retete/sarmale.webp" }} />);
    expect(container.textContent).toBe("Foto: Ana Pop / Unsplash");
    const link = getByRole("link", { name: "Unsplash" });
    expect(link.getAttribute("href")).toBe("https://unsplash.com/photos/sarmale-abc");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("la Wikimedia arată și licența, cu legătură către textul ei", () => {
    const { container, getByRole } = render(<RecipePhotoCredit recipe={{ image_url: "/retete/bulz.webp" }} />);
    expect(container.textContent).toBe("Foto: Ion Pop / Wikimedia Commons · CC BY-SA 3.0");
    expect(getByRole("link", { name: "Wikimedia Commons" }).getAttribute("href")).toBe("https://commons.wikimedia.org/wiki/File:Bulz.jpg");
    expect(getByRole("link", { name: "CC BY-SA 3.0" }).getAttribute("href")).toBe("https://creativecommons.org/licenses/by-sa/3.0");
  });

  it("domeniul public apare fără legătură", () => {
    const { container } = render(<RecipePhotoCredit recipe={{ image_url: "/retete/gris-cu-lapte.webp" }} />);
    expect(container.textContent).toBe("Foto: autor necunoscut / Wikimedia Commons · domeniu public");
    expect(container.querySelectorAll("a")).toHaveLength(1);
  });

  it("la o imagine AI nu arată nicio mențiune", () => {
    expect(render(<RecipePhotoCredit recipe={{ image_url: "/retete/mici-la-gratar.webp" }} />).container.innerHTML).toBe("");
    expect(render(<RecipeVisual recipe={{ image_url: "/retete/mici-la-gratar.webp" }} />).container.querySelector("img")).not.toBeNull();
  });

  it("fără fotografie din catalog nu arată nimic", () => {
    expect(render(<RecipePhotoCredit recipe={{ image_url: null }} />).container.innerHTML).toBe("");
    expect(render(<RecipePhotoCredit recipe={{ image_url: "https://exemplu.ro/ciorba.jpg" }} />).container.innerHTML).toBe("");
  });
});

describe("RecipeAvatar", () => {
  it("în liste, rețeta fără fotografie are un pătrat uniform de 64 px, cu inițiala în serif pe kraft", () => {
    const { getByTestId } = render(<RecipeAvatar recipe={{ name: "Sarmale în foi de varză" }} />);
    const el = getByTestId("avatar-reteta");
    expect(el.className).toContain("h-16 w-16");
    expect(el.className).toContain("bg-surface-2");
    expect(el.className).toContain("border-line");
    expect(el.className).toContain("font-serif");
    expect(el.textContent).toBe("S");
  });

  it("inițiala are majusculă românească, fără spațiile de la început", () => {
    expect(recipeInitial("  ștrudel cu mere")).toBe("Ș");
    expect(recipeInitial("țelină coaptă")).toBe("Ț");
    expect(recipeInitial("")).toBe("?");
  });

  it("știe când rețeta are o fotografie de arătat", () => {
    expect(hasRecipeVisual({ image_url: null })).toBe(false);
    expect(hasRecipeVisual({ image_url: "/retete/retrasa.webp" })).toBe(false);
    expect(hasRecipeVisual({ image_url: "/retete/bulz.webp" })).toBe(true);
  });
});
