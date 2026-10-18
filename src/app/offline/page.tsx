import { WifiOff } from "lucide-react";

export const metadata = { title: "Fără conexiune" };

/** Pagina arătată când deschizi o pagină nouă fără internet și ea nu e încă salvată pe telefon. */
export default function Offline() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-warn-soft text-warn">
        <WifiOff size={28} />
      </span>
      <h1 className="text-xl font-semibold">Nu ai conexiune la internet</h1>
      <p className="mt-2 text-ink-2">Listele tale sunt salvate pe telefon. Deschide aplicația de la început și le găsești acolo; modificările se trimit când revine internetul.</p>
      {/* Navigare completă (nu client-side): pornește aplicația din cache. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand px-5 font-medium text-brand-ink">
        Deschide aplicația
      </a>
    </main>
  );
}
