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
    if (open && !d.open) {
      d.showModal();
      const isCoarse = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)")?.matches;
      if (!isCoarse) {
        d.querySelector<HTMLElement>("[data-autofocus], [autofocus]")?.focus();
      }
    }
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={(event) => { event.stopPropagation(); onClose(); }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      style={keyboardStyle}
      className="m-0 mt-auto flex max-h-[92dvh] w-full max-w-none flex-col overflow-hidden rounded-t-[28px] border-0 bg-surface-container-low p-0 text-ink shadow-elevated backdrop:bg-backdrop-overlay min-[600px]:m-auto min-[600px]:max-w-lg min-[600px]:rounded-[28px]"
    >
      {open && (
        <div
          className="flex max-h-[inherit] flex-1 min-h-0 flex-col overflow-hidden"
          style={keyboardStyle?.maxHeight ? { maxHeight: keyboardStyle.maxHeight } : undefined}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 px-6 pb-2 pt-5">
            <h2 className="min-w-0 break-words text-2xl font-bold leading-tight tracking-tight">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Închide"
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4">{children}</div>
          {footer && (
            <div className={`shrink-0 border-t border-line px-6 pt-4 ${keyboardStyle?.marginBottom ? "pb-4" : "pb-safe pb-6"}`}>
              {footer}
            </div>
          )}
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
          <button
            type="button"
            onClick={onClose}
            className="h-12 flex-1 rounded-full border border-line bg-surface-2 font-medium transition-colors duration-150 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98]"
          >
            Renunță
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="h-12 flex-1 rounded-full bg-error font-medium text-on-error transition-opacity duration-150 ease-out hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:scale-[0.98]"
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
