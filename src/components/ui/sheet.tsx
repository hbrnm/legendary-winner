"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "lucide-react";

/** Cât din partea de jos a ecranului acoperă tastatura (pe iPhone pagina nu se micșorează când apare tastatura). */
export function keyboardInset(innerHeight: number, viewport: { height: number; offsetTop: number }): number {
  return Math.max(0, Math.round(innerHeight - viewport.height - viewport.offsetTop));
}

/** Ridică fereastra deasupra tastaturii și o încape în spațiul rămas vizibil. */
function useKeyboardStyle(active: boolean): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
  useEffect(() => {
    const vv = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!active || !vv) return;
    const update = () => {
      const inset = keyboardInset(window.innerHeight, vv);
      setStyle(inset > 0 ? { marginBottom: inset, maxHeight: Math.round(vv.height * 0.92) } : undefined);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setStyle(undefined);
    };
  }, [active]);
  return style;
}

/**
 * Fereastră care urcă de jos pe telefon (centrată pe ecrane mari). Folosește
 * <dialog>, deci are focus capturat, Escape și fundal blocat din browser.
 */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const keyboardStyle = useKeyboardStyle(open);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      style={keyboardStyle}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-3xl border border-line bg-surface p-0 text-ink shadow-card backdrop:bg-bg/70 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-lg sm:rounded-3xl"
    >
      {open && (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Închide" className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4">{children}</div>
          {footer && <div className="pb-safe border-t border-line px-4 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Confirmare pentru acțiuni greu de anulat (ștergeri). */
export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-line bg-surface font-medium">
            Renunță
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="h-11 flex-1 rounded-xl bg-accent font-medium text-brand-ink"
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-[15px] text-ink-2">{message}</div>
    </Sheet>
  );
}
