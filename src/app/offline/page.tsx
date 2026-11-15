import { StandalonePage } from "@/components/ui/standalone-page";
import { WifiOff } from "lucide-react";
import { Card } from "@/components/ui/misc";

export const metadata = { title: "Fără conexiune" };

/** Pagina arătată când deschizi o pagină nouă fără internet și ea nu e încă salvată pe telefon. */
export default function Offline() {
  return (
    <StandalonePage centered>
      <Card className="flex flex-col items-center p-6 text-center">
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-warn-soft text-warn">
          <WifiOff size={28} />
        </span>
        <h1 className="min-w-0 break-words text-[32px] font-bold leading-tight tracking-tight">Nu ai conexiune la internet</h1>
        <p className="mt-2 text-ink-2">Listele tale sunt salvate pe telefon. Deschide aplicația de la început și le găsești acolo; modificările se trimit când revine internetul.</p>
        {/* Navigare completă (nu client-side): pornește aplicația din cache. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-brand px-5 font-medium text-brand-ink">
          Deschide aplicația
        </a>
      </Card>
    </StandalonePage>
  );
}
