export type Theme = "sistem" | "luminos" | "intunecat";
const KEY = "camara-tema";
export const THEME_COLORS = { luminos: "#F7F3EE", intunecat: "#191410" } as const;
const OVERRIDE_ID = "camara-theme-override";

export const THEME_BOOTSTRAP = `try {
  var theme = localStorage.getItem(${JSON.stringify(KEY)});
  var colors = ${JSON.stringify(THEME_COLORS)};
  if (theme === "luminos" || theme === "intunecat") {
    document.documentElement.dataset.theme = theme;
    var tag = document.createElement("meta");
    tag.id = ${JSON.stringify(OVERRIDE_ID)};
    tag.name = "theme-color";
    tag.content = colors[theme];
    document.head.prepend(tag);
  }
} catch {}`;

export function getTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === "luminos" || t === "intunecat" ? t : "sistem";
  } catch {
    return "sistem";
  }
}

export function setTheme(t: Theme) {
  try {
    if (t === "sistem") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
  } catch {}
  if (t === "sistem") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = t;
  const override = document.querySelector<HTMLMetaElement>(`#${OVERRIDE_ID}`);
  if (t === "sistem") {
    override?.remove();
    return;
  }
  const meta = override ?? document.createElement("meta");
  meta.id = OVERRIDE_ID;
  meta.name = "theme-color";
  meta.content = THEME_COLORS[t];
  if (!override) document.head.prepend(meta);
}
