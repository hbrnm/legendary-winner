import type { ReactNode } from "react";

/** Cadru comun pentru paginile accesibile și în afara gospodăriei. */
export function StandalonePage({ children, centered = false, wide = false }: { children: ReactNode; centered?: boolean; wide?: boolean }) {
  return (
    <div className="ritm-standalone">
      <main className={`mx-auto w-full px-5 py-8 ${wide ? "max-w-3xl" : "max-w-lg"} ${centered ? "flex min-h-dvh flex-col justify-center" : ""}`}>
        {children}
      </main>
    </div>
  );
}
