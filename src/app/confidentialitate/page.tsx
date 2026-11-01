"use client";

import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/misc";

export default function ConfidentialitatePage() {
  return (
    <div className="min-h-screen bg-bg px-4 py-8 text-ink">
      <main className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <ArrowLeft size={16} /> Înapoi la aplicație
          </Link>
        </div>

        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold uppercase tracking-wider text-brand">
            <ShieldCheck size={14} /> Confidențialitate
          </div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-ink">
            Politica de Confidențialitate
          </h1>
          <p className="mt-2 text-sm text-ink-2">
            Ultima actualizare: 1 noiembrie 2026 · Ciornă de lucru pentru lansare
          </p>
        </header>

        <Card className="flex flex-col gap-6 p-6 leading-relaxed">
          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">1. Cine suntem (Operatorul de date)</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              Aplicația <strong>Cămara</strong> este un serviciu dedicat organizării cumpărăturilor, rețetelor, alimentelor din cămară și bugetului gospodăriei.
            </p>
            <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3 text-sm text-ink-2">
              <p className="font-medium text-ink">Datele operatorului [DE COMPLETAT]:</p>
              <p>Denumire: [DE COMPLETAT: Nume operator / Persoană Fizică / Societate Comercială]</p>
              <p>Adresă / Sediu: [DE COMPLETAT: Adresă completă, România]</p>
              <p>Email contact pentru protecția datelor: [DE COMPLETAT: contact@appcamara.ro]</p>
            </div>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">2. Principiul Local-First și Datele colectate</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              Cămara este proiectată pe o arhitectură <em>local-first</em>. Asta înseamnă că datele tale sunt stocate și procesate în primul rând direct pe dispozitivul tău, într-o bază de date locală (IndexedDB).
            </p>
            <ul className="mt-2 list-disc pl-5 text-[15px] text-ink-2 space-y-1">
              <li>
                <strong>Modul demonstrativ (fără cont):</strong> Toate listele, rețetele, produsele din cămară și cheltuielile rămân exclusiv pe dispozitivul tău. Nicio dată cu caracter personal nu este transmisă către servere.
              </li>
              <li>
                <strong>Modul cu cont (Sincronizare cloud):</strong> Colectăm doar adresa de email și o parolă criptată prin Supabase Auth, plus numele afișat pe care îl alegi pentru gospodărie. Datele gospodăriei sunt sincronizate pentru a fi accesibile de pe mai multe dispozitive ale membrilor gospodăriei.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">3. Unde stau datele și cum sunt protejate</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              Pentru utilizatorii autentificați, datele sincronizate sunt găzduite prin infrastructura securizată Supabase în Uniunea Europeană (regiunea Frankfurt, Germania — <code>eu-central-1</code>).
            </p>
            <p className="mt-2 text-[15px] text-ink-2">
              Toate tabelele sunt protejate prin politici stricte de securitate la nivel de rând (Row Level Security - RLS). Un utilizator poate citi sau modifica exclusiv datele aparținând gospodăriilor din care face parte oficial. Fotografiile rețetelor sunt stocate într-un depozit privat și sunt accesibile doar membrilor gospodăriei.
            </p>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">4. Servicii externe și prelucrări asistate</h2>
            <ul className="mt-2 list-disc pl-5 text-[15px] text-ink-2 space-y-2">
              <li>
                <strong>Citirea bonurilor (OCR):</strong> Recunoașterea textului de pe bon se realizează local pe telefon (Tesseract.js) sau opțional prin asistent AI (Gemini). Imaginea decupată a bonului este trimisă exclusiv pentru extragerea liniilor de produse și nu este stocată pe server.
              </li>
              <li>
                <strong>Importul rețetelor de pe internet:</strong> Când furnizezi o adresă web (URL) pentru o rețetă, serverul descarcă doar conținutul public al acelei pagini pentru a extrage ingredientele și pașii de preparare.
              </li>
              <li>
                <strong>Traducerea rețetelor:</strong> Textele rețetelor pot fi traduse prin servicii externe dedicate (Gemini / MyMemory). Sunt trimise strict denumirile ingredientelor și instrucțiunile culinare, fără date de identificare personală.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">5. Drepturile tale conform GDPR (Art. 15–22)</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              Conform Regulamentului General privind Protecția Datelor (GDPR), beneficiezi de drepturi depline asupra datelor tale:
            </p>
            <ul className="mt-2 list-disc pl-5 text-[15px] text-ink-2 space-y-2">
              <li>
                <strong>Dreptul de acces și portabilitate (Art. 15, 20):</strong> Poți descărca oricând o copie completă a datelor gospodăriei în format JSON din ecranul <em>Gospodărie → Descarcă o copie</em>.
              </li>
              <li>
                <strong>Dreptul la ștergerea datelor / „Dreptul de a fi uitat” (Art. 17):</strong> Îți poți șterge definitiv contul oricând direct din aplicație din ecranul <em>Gospodărie → Contul tău → Șterge contul</em>. Dacă ești unicul membru al gospodăriei, întreaga gospodărie și fotografiile asociate se șterg definitiv și ireversibil din baza de date și din spațiul de stocare.
              </li>
              <li>
                <strong>Dreptul la rectificare (Art. 16):</strong> Poți actualiza oricând numele de profil și detaliile din cont.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-serif text-lg font-semibold text-ink">6. Contact</h2>
            <p className="mt-2 text-[15px] text-ink-2">
              Pentru orice întrebări sau solicitări legate de confidențialitatea datelor tale, ne poți contacta la adresa de email: <strong>[DE COMPLETAT: contact@appcamara.ro]</strong>.
            </p>
          </section>
        </Card>

        <footer className="mt-8 flex justify-center gap-4 text-xs text-ink-2">
          <Link href="/termeni" className="hover:underline">
            Termeni și condiții de utilizare
          </Link>
          <span>·</span>
          <Link href="/" className="hover:underline">
            Aplicația Cămara
          </Link>
        </footer>
      </main>
    </div>
  );
}
