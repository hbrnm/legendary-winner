// Versiunea nouă a aplicației: service worker-ul nou preia controlul singur
// (skipWaiting + clients.claim în src/sw/sw.template.js), dar pagina deschisă
// rulează codul vechi până la reîncărcare. Aici aflăm când s-a întâmplat asta,
// ca să-i spunem omului (decizia proprietarului, 23 oct. 2026).

type Container = {
  controller: unknown;
  addEventListener(type: "controllerchange", fn: () => void): void;
  removeEventListener(type: "controllerchange", fn: () => void): void;
};

/** Cheamă `onUpdate` când o versiune nouă o înlocuiește pe cea care rula; la prima instalare, nu. */
export function watchUpdates(sw: Container, onUpdate: () => void): () => void {
  let hadController = Boolean(sw.controller);
  const handler = () => {
    if (hadController) onUpdate();
    hadController = true;
  };
  sw.addEventListener("controllerchange", handler);
  return () => sw.removeEventListener("controllerchange", handler);
}

const HOUR = 60 * 60 * 1000;

/** Cere browserului să caute o versiune nouă la revenirea în aplicație și din oră în oră, doar cu internet. */
export function checkForUpdates(
  registration: { update(): Promise<unknown> },
  doc: EventTarget & { visibilityState: string },
  isOnline: () => boolean,
): () => void {
  const check = () => {
    if (isOnline()) registration.update().catch(() => {});
  };
  const onVisible = () => {
    if (doc.visibilityState === "visible") check();
  };
  doc.addEventListener("visibilitychange", onVisible);
  const timer = setInterval(check, HOUR);
  return () => {
    doc.removeEventListener("visibilitychange", onVisible);
    clearInterval(timer);
  };
}
