import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import * as icons from "./icons";

describe("iconițele Cămarei", () => {
  for (const [name, Icon] of Object.entries(icons)) {
    if (typeof Icon !== "function") continue;
    it(`${name} se desenează cu culoarea textului și e ascunsă cititorului de ecran`, () => {
      const html = renderToStaticMarkup(<Icon size={20} strokeWidth={2} className="text-brand" />);
      expect(html).toMatch(/^<svg[^>]* width="20" height="20" viewBox="0 0 24 24"/);
      expect(html).toContain('stroke="currentColor"');
      expect(html).toContain('stroke-width="2"');
      expect(html).toContain('aria-hidden="true"');
      expect(html).toContain('class="text-brand"');
      expect(html).toContain("<path");
    });
  }
});
