"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { isGtin } from "@/lib/domain/barcode";

export function BarcodeCamera({ onRead, onClose, closeLabel = "Închide camera" }: { onRead: (code: string) => void; onClose: () => void; closeLabel?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let stream: MediaStream | undefined;
    let controls: { stop(): void } | undefined;
    let stopped = false;

    function stop() {
      stopped = true;
      controls?.stop();
      stream?.getTracks().forEach((track) => track.stop());
    }

    async function start() {
      try {
        const { BrowserMultiFormatOneDReader } = await import("@zxing/browser");
        if (stopped || !video.current) return;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" } } });
        if (stopped || !video.current) {
          stop();
          return;
        }
        const reader = new BrowserMultiFormatOneDReader();
        controls = await reader.decodeFromStream(stream, video.current, (result, _, active) => {
          const code = result?.getText();
          if (!stopped && code && isGtin(code)) {
            controls = active;
            stop();
            onRead(code);
          }
        });
        if (stopped) stop();
      } catch {
        if (!stopped) {
          stop();
          setError("Camera nu poate porni. Verifică permisiunea sau introdu codul manual.");
        }
      }
    }

    function stopWhenHidden() {
      if (document.hidden) onClose();
    }
    document.addEventListener("visibilitychange", stopWhenHidden);
    void start();
    return () => {
      document.removeEventListener("visibilitychange", stopWhenHidden);
      stop();
    };
  }, [onRead, onClose]);

  return (
    <div className="space-y-2">
      {!error && <video ref={video} muted playsInline className="aspect-video w-full rounded-xl bg-ink object-contain" aria-label="Imaginea camerei pentru codul de bare" />}
      {error ? <p role="alert" className="text-sm">{error}</p> : <p className="text-sm text-ink-2">Ține codul orizontal în imagine.</p>}
      <Button variant="ghost" onClick={onClose}>{closeLabel}</Button>
    </div>
  );
}
