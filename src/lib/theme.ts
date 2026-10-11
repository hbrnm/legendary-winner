export type Theme = "sistem" | "luminos" | "intunecat";
const KEY = "camara-tema";

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
}
