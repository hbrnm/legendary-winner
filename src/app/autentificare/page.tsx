"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Warehouse } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { Button } from "@/components/ui/button";
import { LabeledInput, Segmented } from "@/components/ui/fields";
import { Spinner } from "@/components/ui/misc";
import { isCloudConfigured, supabase } from "@/lib/supabase/client";

type Mode = "intrare" | "cont" | "resetare" | "parola-noua";

/** Mesaje Supabase Auth traduse; restul primesc un mesaj general. */
function authMessage(message: string): string {
  if (/invalid login credentials/i.test(message)) return "Emailul sau parola nu sunt corecte.";
  if (/already registered|already exists/i.test(message)) return "Există deja un cont cu acest email. Intră în cont sau resetează parola.";
  if (/password should be at least|weak password/i.test(message)) return "Parola trebuie să aibă cel puțin 8 caractere.";
  if (/email not confirmed/i.test(message)) return "Confirmă întâi adresa de email, din mesajul primit.";
  if (/rate limit|too many/i.test(message)) return "Prea multe încercări. Așteaptă câteva minute și încearcă din nou.";
  if (/fetch|network/i.test(message)) return "Nu ai conexiune la internet.";
  return "Nu a mers. Verifică datele și încearcă din nou.";
}

function AuthScreen() {
  const app = useApp();
  const router = useRouter();
  const params = useSearchParams();
  // Doar o pagină a aplicației: nu „//alt-site.ro” sau „/\alt-site.ro”, pe care browserul le-ar deschide ca alt site.
  const asked = params.get("inapoi") ?? "";
  const back = /^\/(?![/\\])/.test(asked) ? asked : "/";
  const [mode, setMode] = useState<Mode>("intrare");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isCloudConfigured) return;
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("parola-noua");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (mode !== "parola-noua" && (app.status === "ready" || app.status === "no_household")) router.replace(back);
  }, [app.status, back, mode, router]);

  if (!isCloudConfigured) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-lg font-semibold">Aplicația rulează în mod demonstrativ</p>
        <p className="mt-2 text-ink-2">Conturile și sincronizarea cer configurarea Supabase (vezi ENVIRONMENT_VARIABLES.md). Până atunci, datele rămân pe acest dispozitiv.</p>
        <Link href="/" className="mt-6 inline-block font-medium text-brand underline">
          Deschide aplicația
        </Link>
      </div>
    );
  }

  async function submit() {
    setError(null);
    setInfo(null);
    if (mode !== "parola-noua" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) return setError("Scrie o adresă de email validă.");
    if ((mode === "cont" || mode === "parola-noua") && password.length < 8) return setError("Parola trebuie să aibă cel puțin 8 caractere.");
    if (mode === "cont" && !name.trim()) return setError("Scrie cum vrei să te vadă ceilalți membri.");
    setBusy(true);
    try {
      const auth = supabase().auth;
      if (mode === "intrare") {
        const { error: e } = await auth.signInWithPassword({ email: email.trim(), password });
        if (e) throw e;
      } else if (mode === "cont") {
        const { data, error: e } = await auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${window.location.origin}/autentificare/?inapoi=${encodeURIComponent(back)}` },
        });
        if (e) throw e;
        if (!data.session) setInfo("Ți-am trimis un email de confirmare. Deschide linkul din el, apoi intră în cont.");
      } else if (mode === "resetare") {
        const { error: e } = await auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/autentificare/` });
        if (e) throw e;
        setInfo("Dacă există un cont cu acest email, ai primit un link pentru o parolă nouă.");
      } else {
        const { error: e } = await auth.updateUser({ password });
        if (e) throw e;
        setInfo("Parola a fost schimbată.");
        setMode("intrare");
        router.replace("/");
      }
    } catch (e) {
      setError(authMessage(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-8 flex flex-col items-center text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-ink">
          <Warehouse size={28} />
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Cămara</h1>
        <p className="mt-1 text-sm text-ink-2">Cumpărături, rețete și bugetul casei, împreună.</p>
      </div>

      {(mode === "intrare" || mode === "cont") && (
        <Segmented<Mode>
          label="Intrare sau cont nou"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setError(null);
          }}
          options={[
            { value: "intrare", label: "Intră în cont" },
            { value: "cont", label: "Cont nou" },
          ]}
        />
      )}
      {mode === "resetare" && <h2 className="text-lg font-semibold">Ai uitat parola?</h2>}
      {mode === "parola-noua" && <h2 className="text-lg font-semibold">Alege o parolă nouă</h2>}

      <form
        className="mt-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {mode === "cont" && <LabeledInput label="Numele tău" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={60} placeholder="ex. Ana" />}
        {mode !== "parola-noua" && <LabeledInput label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />}
        {mode !== "resetare" && (
          <LabeledInput
            label={mode === "parola-noua" ? "Parola nouă" : "Parola"}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "intrare" ? "current-password" : "new-password"}
            hint={mode !== "intrare" ? "Cel puțin 8 caractere." : undefined}
          />
        )}
        {error && (
          <p role="alert" className="rounded-xl bg-accent-soft px-3 py-2 text-sm text-accent">
            {error}
          </p>
        )}
        {info && (
          <p role="status" className="rounded-xl bg-brand-soft px-3 py-2 text-sm text-brand">
            {info}
          </p>
        )}
        <Button type="submit" block size="lg" disabled={busy}>
          {mode === "intrare" ? "Intră" : mode === "cont" ? "Creează contul" : mode === "resetare" ? "Trimite linkul" : "Salvează parola"}
        </Button>
      </form>

      {mode === "intrare" && (
        <button type="button" onClick={() => setMode("resetare")} className="mt-4 text-sm text-ink-2 underline underline-offset-2">
          Am uitat parola
        </button>
      )}
      {mode === "resetare" && (
        <button type="button" onClick={() => setMode("intrare")} className="mt-4 text-sm text-ink-2 underline underline-offset-2">
          Înapoi la intrare
        </button>
      )}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <AuthScreen />
    </Suspense>
  );
}
