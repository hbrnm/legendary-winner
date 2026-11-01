"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { checkForUpdates, watchUpdates } from "@/lib/app-update";

/**
 * Înregistrează service worker-ul (doar în producție), pentru instalare și folosire offline,
 * și arată jos un mesaj când a apărut o versiune nouă a aplicației.
 */
export function ServiceWorker() {
  const [updated, setUpdated] = useState(false);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const sw = navigator.serviceWorker;
    const stopWatching = watchUpdates(sw, () => setUpdated(true));
    let stopChecking = () => {};
    sw.register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        stopChecking = checkForUpdates(reg, document, () => navigator.onLine);
      })
      .catch((e) => {
        console.warn("Nu s-a putut înregistra service worker-ul:", e);
      });
    return () => {
      stopWatching();
      stopChecking();
    };
  }, []);
  return updated ? <UpdateBanner onReload={() => window.location.reload()} onLater={() => setUpdated(false)} /> : null;
}

export function UpdateBanner({ onReload, onLater }: { onReload: () => void; onLater: () => void }) {
  return (
    <div role="status" className="bottom-nav-safe fixed inset-x-0 z-50 mb-3 px-4 lg:bottom-6 lg:mb-0">
      <div className="mx-auto flex max-w-md flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-surface px-4 py-3 shadow-card">
        <p className="min-w-0 basis-full text-[15px] text-ink sm:flex-1 sm:basis-auto">Am adus o versiune nouă a Cămării.</p>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={onLater}>
            Mai târziu
          </Button>
          <Button size="sm" onClick={onReload}>
            Reîncarcă
          </Button>
        </div>
      </div>
    </div>
  );
}
