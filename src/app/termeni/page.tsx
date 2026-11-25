"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "@/components/ui/icons";
import { Card, PageTitle } from "@/components/ui/misc";
import { StandalonePage } from "@/components/ui/standalone-page";

export default function TermeniPage() {
  return (
    <StandalonePage wide>
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-2 text-sm font-medium text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ArrowLeft size={16} /> Înapoi la aplicație
        </Link>
      </div>

      <header className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
          <FileText size={14} /> Condiții de utilizare
        </div>
        <PageTitle>
          Termeni și Condiții
        </PageTitle>
        <p className="mt-2 text-sm text-ink-2">
          Ultima actualizare: 1 noiembrie 2026 · Ciornă de lucru pentru lansare
        </p>
      </header>

      <Card className="flex flex-col gap-6 p-6 leading-relaxed">
        <section>
          <h2 className="text-section-title font-semibold tracking-tight text-on-surface">1. Acceptarea Termenilor</h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Prin accesarea sau utilizarea aplicației <strong>Cămara</strong> (disponibilă ca aplicație web progresivă la <code>appcamara.vercel.app</code> sau prin domenii asociate), confirmi că ai citit, înțeles și ești de acord cu acești Termeni și Condiții, precum și cu{" "}
            <Link href="/confidentialitate" className="text-brand underline underline-offset-2">
              Politica de Confidențialitate
            </Link>
            .
          </p>
        </section>

        <section>
          <h2 className="text-section-title font-semibold tracking-tight text-on-surface">2. Descrierea Serviciului</h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Cămara este un instrument de organizare domestică conceput pentru a ajuta membrii unei gospodării să țină evidența listelor de cumpărături, stocului de alimente din cămară, planului de mese și estimării bugetelor.
          </p>
          <p className="mt-2 text-[15px] text-ink-2">
            Serviciul poate fi folosit în mod demonstrativ fără cont (stocare locală pe dispozitiv) sau cu cont de utilizator pentru colaborare între membrii aceleiași gospodării.
          </p>
        </section>

        <section>
          <h2 className="text-section-title font-semibold tracking-tight text-on-surface">3. Conturi, Gospodării și Colaborare</h2>
          <ul className="mt-2 list-disc pl-5 text-[15px] text-ink-2 space-y-2">
            <li>
              <strong>Securitatea contului:</strong> Ești responsabil pentru păstrarea confidențialității parolei tale și pentru toate activitățile desfășurate prin contul tău.
            </li>
            <li>
              <strong>Roluri în gospodărie:</strong> Gospodăriile sunt administrate de Proprietar (Owner) și Administratori (Admin). Proprietarul decide componența gospodăriei și poate transfera dreptul de proprietate.
            </li>
            <li>
              <strong>Ștergerea contului și a gospodăriei:</strong> Orice membru își poate șterge contul oricând din setări. Dacă proprietarul este singurul membru al gospodăriei, gospodăria este ștearsă integral. Dacă există alți membri, proprietarul trebuie să desemneze un alt proprietar înainte de a părăsi/șterge contul.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-section-title font-semibold tracking-tight text-on-surface">4. Conținutul introdus și Drepturile de autor</h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Datele pe care le introduci (liste, produse, note, fotografii ale rețetelor preparate) îți aparțin în totalitate. La utilizarea funcției de import de rețete de pe internet, ai obligația de a respecta drepturile de autor ale site-urilor sursă, folosind materialele importate strict pentru uz casnic personal.
          </p>
        </section>

        <section>
          <h2 className="text-section-title font-semibold tracking-tight text-on-surface">5. Disponibilitate și Limitări de răspundere</h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Aplicația Cămara este furnizată „așa cum este” (<em>as-is</em>). Deși depunem toate eforturile pentru securitate și integritatea sincronizării, recomandăm descărcarea periodică a unei copii de siguranță locale (format JSON) din meniul Gospodărie.
          </p>
          <p className="mt-2 text-[15px] text-ink-2">
            Estimările de buget, densitățile ingredientelor și datele de valabilitate orientative au caracter informativ și nu înlocuiesc verificarea efectivă a produselor de către utilizator.
          </p>
        </section>

        <section>
          <h2 className="text-section-title font-semibold tracking-tight text-on-surface">6. Modificări și Contact</h2>
          <p className="mt-2 text-[15px] text-ink-2">
            Ne rezervăm dreptul de a actualiza acești termeni pe măsură ce aplicația evoluează. Pentru nelămuriri sau asistență, ne poți contacta la: <strong>[DE COMPLETAT: contact@appcamara.ro]</strong>.
          </p>
        </section>
      </Card>

      <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 text-xs text-ink-2">
        <Link href="/confidentialitate" className="inline-flex min-h-12 items-center rounded-full px-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand">
          Politica de confidențialitate
        </Link>
        <span>·</span>
        <Link href="/" className="inline-flex min-h-12 items-center rounded-full px-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand">
          Aplicația Cămara
        </Link>
      </footer>
    </StandalonePage>
  );
}

