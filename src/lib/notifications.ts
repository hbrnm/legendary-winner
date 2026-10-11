// Notificări locale pentru produsele care expiră. Se arată cel mult o dată pe
// zi, când aplicația e deschisă. (Notificările trimise de server, cu aplicația
// închisă, cer chei VAPID și un serviciu de trimitere; vezi DEPLOYMENT.md.)

const KEY = "camara-notificari-expirare";

export function expiryNotificationsEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "da" && typeof Notification !== "undefined" && Notification.permission === "granted";
  } catch {
    return false;
  }
}

export async function enableExpiryNotifications(): Promise<boolean> {
  if (typeof Notification === "undefined") return false;
  const p = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  try {
    localStorage.setItem(KEY, p === "granted" ? "da" : "nu");
  } catch {}
  return p === "granted";
}

export function disableExpiryNotifications() {
  try {
    localStorage.setItem(KEY, "nu");
  } catch {}
}

export async function notifyExpiring(names: string[], today: string): Promise<void> {
  if (!names.length || !expiryNotificationsEnabled()) return;
  const dayKey = `${KEY}-${today}`;
  try {
    if (localStorage.getItem(dayKey)) return;
    localStorage.setItem(dayKey, "1");
  } catch {
    return;
  }
  const body = names.length === 1 ? `${names[0]} expiră curând.` : `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` și încă ${names.length - 3}` : ""} expiră curând.`;
  const reg = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
  if (reg) await reg.showNotification("Cămara", { body, tag: "expirare", icon: "/icons/icon-192.png", data: { url: "/camara/" } });
  else new Notification("Cămara", { body, tag: "expirare" });
}
