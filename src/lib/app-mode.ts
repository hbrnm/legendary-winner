export type AppMode = "demo" | "cloud";
export const DEMO_MODE_KEY = "camara-demo-activ";

type ModeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Preferința schimbă doar modul aplicației, fără a atinge datele sau sesiunea contului. */
export function resolveAppMode(cloudConfigured: boolean, search: string, storage: ModeStorage | null, persistSelection = true): AppMode {
  if (!cloudConfigured) return "demo";
  const requested = new URLSearchParams(search).get("demo");
  if (requested === "1" || requested === "0") {
    try {
      if (persistSelection) {
        if (requested === "1") storage?.setItem(DEMO_MODE_KEY, "1");
        else storage?.removeItem(DEMO_MODE_KEY);
      }
    } catch {
      // Alegerea explicită funcționează și când browserul nu poate păstra preferința.
    }
    return requested === "1" ? "demo" : "cloud";
  }
  try {
    return storage?.getItem(DEMO_MODE_KEY) === "1" ? "demo" : "cloud";
  } catch {
    return "cloud";
  }
}
