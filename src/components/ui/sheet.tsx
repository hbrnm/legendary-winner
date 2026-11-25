"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { X } from "@/components/ui/icons";
import { Button } from "./button";

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
export function Sheet({
  open,
  onClose,
  title,
  fullscreen = false,
  headerAction,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  fullscreen?: boolean;
  headerAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const keyboardStyle = useKeyboardStyle(open);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus], [autofocus]")?.focus();
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
      className={`w-full overflow-hidden border-0 bg-surface-container-low p-0 text-on-surface shadow-elevated backdrop:bg-backdrop-overlay ${fullscreen ? "inset-0 m-0 h-dvh max-h-none max-w-none min-[600px]:m-auto min-[600px]:h-[min(760px,92dvh)] min-[600px]:max-w-2xl min-[600px]:rounded-[28px]" : "m-0 mt-auto max-h-[92dvh] max-w-none rounded-t-[28px] min-[600px]:m-auto min-[600px]:max-w-lg min-[600px]:rounded-[28px]"}`}
    >
      {open && (
        <div
          className={`flex max-h-[inherit] min-h-0 flex-1 flex-col overflow-hidden ${fullscreen ? "h-full" : ""}`}
          style={keyboardStyle?.maxHeight ? { maxHeight: keyboardStyle.maxHeight } : undefined}
        >
          <div className={`flex shrink-0 items-center justify-between gap-2 px-6 pb-2 ${fullscreen ? "pt-[max(1.25rem,env(safe-area-inset-top))]" : "pt-5"}`}>
            <h2 className="min-w-0 break-words text-2xl font-bold leading-tight tracking-tight">{title}</h2>
            <div className="flex items-center gap-2">
              {headerAction}
              <button
                type="button"
                onClick={onClose}
                aria-label="Închide"
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors duration-150 ease-out hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X size={20} />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 py-4 scroll-pb-20">{children}</div>
          {footer && (
            <div className={`shrink-0 border-t border-outline-variant bg-surface-container px-6 pt-4 ${fullscreen ? "pb-[max(1.5rem,env(safe-area-inset-bottom))]" : keyboardStyle?.marginBottom ? "pb-6" : "pb-safe pb-6"}`}>
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
          <Button
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Renunță
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <div className="text-[15px] text-ink-2">{message}</div>
    </Sheet>
  );
}
