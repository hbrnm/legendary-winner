"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Users } from "lucide-react";
import { useApp } from "@/components/app/app-provider";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/misc";
import { acceptInvitation, previewInvitation } from "@/lib/services/household";
import { UserError } from "@/lib/services/context";
import { isCloudConfigured } from "@/lib/supabase/client";

function InvitationScreen() {
  const token = useSearchParams().get("token") ?? "";
  const app = useApp();
  const router = useRouter();
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewInvitation>> | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signedIn = app.status === "ready" || app.status === "no_household";

  useEffect(() => {
    if (!signedIn || !token) return;
    previewInvitation(token)
      .then(setPreview)
      .catch((e) => setError(e instanceof UserError ? e.message : "Nu am putut verifica invitația."));
  }, [signedIn, token]);

  if (!isCloudConfigured) return <Centered title="Invitațiile cer un cont">Aplicația rulează în mod demonstrativ, fără conturi.</Centered>;
  if (app.status === "loading") return <Spinner />;
  if (!signedIn) {
    return (
      <Centered title="Ai fost invitat într-o gospodărie">
        Intră în cont sau fă-ți unul, apoi acceptă invitația.
        <Link href={`/autentificare/?inapoi=${encodeURIComponent(`/invitatie/?token=${token}`)}`} className="mt-6 inline-flex h-11 items-center rounded-xl bg-brand px-5 font-medium text-brand-ink">
          Continuă
        </Link>
      </Centered>
    );
  }
  if (error) return <Centered title="Invitația nu poate fi folosită">{error}</Centered>;
  if (preview === undefined) return <Spinner />;
  if (preview === null) return <Centered title="Invitația nu mai este valabilă">A expirat, a fost anulată sau a fost deja folosită. Cere o invitație nouă.</Centered>;

  return (
    <Centered title={`Intră în „${preview.household_name}”`}>
      {preview.invited_by} te-a invitat ca {preview.role === "admin" ? "administrator" : "membru"}. Vei vedea și vei modifica împreună listele, planul, cămara și bugetul gospodăriei.
      <Button
        className="mt-6"
        size="lg"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const id = await acceptInvitation(token);
            await app.refreshHouseholds();
            await app.switchHousehold(id);
            router.replace("/");
          } catch (e) {
            setError(e instanceof UserError ? e.message : "Nu am putut accepta invitația.");
          } finally {
            setBusy(false);
          }
        }}
      >
        Accept invitația
      </Button>
    </Centered>
  );
}

function Centered({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Users size={28} />
      </span>
      <h1 className="text-xl font-semibold">{title}</h1>
      <div className="mt-2 flex flex-col items-center text-ink-2">{children}</div>
    </main>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <InvitationScreen />
    </Suspense>
  );
}
