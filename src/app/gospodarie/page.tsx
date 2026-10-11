"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, Copy, Crown, Download, LogOut, MapPin, Plus, Share2, Shield, Trash2, UserMinus, Users } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { useApp } from "@/components/app/app-provider";
import { useAction, useData } from "@/components/app/hooks";
import { Button, IconButton } from "@/components/ui/button";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui/misc";
import { ConfirmSheet, Sheet } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelect, Segmented, Toggle } from "@/components/ui/fields";
import { useToast } from "@/components/ui/toast";
import * as hh from "@/lib/services/household";
import { UserError } from "@/lib/services/context";
import { createRetailer, deleteRetailer, updateRetailer } from "@/lib/services/catalog";
import { setPantryOnPurchase } from "@/lib/services/kitchen";
import { exportHouseholdData } from "@/lib/services/backup";
import { owned } from "@/lib/services/queries";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { disableExpiryNotifications, enableExpiryNotifications, expiryNotificationsEnabled } from "@/lib/notifications";
import { formatShortDate } from "@/lib/domain/dates";
import type { PantryOnPurchase, Retailer, RetailerKind } from "@/lib/domain/types";

const ROLE_LABELS = { owner: "Proprietar", admin: "Administrator", member: "Membru" } as const;

/** Prima gospodărie, după înregistrare. */
function CreateHousehold({ first }: { first: boolean }) {
  const app = useApp();
  const [name, setName] = useState(first ? "Familia mea" : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const id = await hh.createHousehold(name);
          await app.refreshHouseholds();
          await app.switchHousehold(id);
        } catch (err) {
          setError(err instanceof UserError ? err.message : "Nu am putut crea gospodăria.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <LabeledInput label="Numele gospodăriei" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} error={error} placeholder="ex. Familia Popescu" />
      <Button type="submit" disabled={busy}>
        Creează gospodăria
      </Button>
    </form>
  );
}

function Members() {
  const app = useApp();
  const toast = useToast();
  const household = app.household!;
  const isAdmin = household.role === "owner" || household.role === "admin";
  const [members, setMembers] = useState<hh.Member[] | null>(null);
  const [invites, setInvites] = useState<hh.Invitation[]>([]);
  const [inviting, setInviting] = useState(false);
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [created, setCreated] = useState<hh.Invitation | null>(null);
  const [selected, setSelected] = useState<hh.Member | null>(null);
  const [offline, setOffline] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let alive = true;
    Promise.all([hh.listMembers(household.id), isAdmin ? hh.listInvitations(household.id) : Promise.resolve([])])
      .then(([m, i]) => {
        if (!alive) return;
        setMembers(m);
        setInvites(i);
        setOffline(false);
      })
      .catch(() => alive && setOffline(true));
    return () => {
      alive = false;
    };
  }, [household.id, isAdmin, reloadKey]);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    try {
      await fn();
      if (ok) toast(ok);
      load();
    } catch (e) {
      toast(e instanceof UserError ? e.message : "Nu a mers. Încearcă din nou.", { tone: "error" });
    }
  }

  if (offline) return <p className="text-sm text-ink-2">Membrii și invitațiile se văd doar cu internet.</p>;
  if (!members) return <p className="text-sm text-ink-2">Se încarcă membrii…</p>;

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
        {members.map((m) => (
          <li key={m.user_id}>
            <button type="button" disabled={!isAdmin && m.user_id !== app.userId} onClick={() => setSelected(m)} className="flex min-h-14 w-full items-center gap-3 px-4 text-left disabled:cursor-default">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-soft font-semibold text-brand">{m.display_name.slice(0, 1).toUpperCase()}</span>
              <span className="flex-1">
                {m.display_name}
                {m.user_id === app.userId && <span className="text-ink-2"> (tu)</span>}
              </span>
              <Badge tone={m.role === "owner" ? "brand" : "neutral"}>
                {m.role === "owner" ? <Crown size={12} /> : m.role === "admin" ? <Shield size={12} /> : null}
                {ROLE_LABELS[m.role]}
              </Badge>
            </button>
          </li>
        ))}
      </ul>

      {isAdmin && (
        <>
          <Button className="mt-3" variant="secondary" icon={<Plus size={18} />} onClick={() => setInviting(true)}>
            Invită pe cineva
          </Button>
          {invites.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-sm text-ink-2">Invitații în așteptare</p>
              <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-2 px-4 py-2 text-sm">
                    <span className="flex-1">
                      {i.email ?? "Link de invitație"} · {ROLE_LABELS[i.role]} · până pe {formatShortDate(i.expires_at.slice(0, 10))}
                    </span>
                    <IconButton
                      label="Copiază linkul"
                      onClick={async () => {
                        await navigator.clipboard?.writeText(hh.invitationLink(i.token));
                        toast("Linkul a fost copiat.");
                      }}
                    >
                      <Copy size={16} />
                    </IconButton>
                    <IconButton label="Anulează invitația" onClick={() => act(() => hh.revokeInvitation(i.id), "Invitația a fost anulată.")}>
                      <Trash2 size={16} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <Sheet
        open={inviting}
        onClose={() => {
          setInviting(false);
          setCreated(null);
        }}
        title="Invită în gospodărie"
        footer={
          created ? (
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                icon={<Copy size={18} />}
                onClick={async () => {
                  await navigator.clipboard?.writeText(hh.invitationLink(created.token));
                  toast("Linkul a fost copiat.");
                }}
              >
                Copiază
              </Button>
              {typeof navigator !== "undefined" && "share" in navigator && (
                <Button className="flex-1" icon={<Share2 size={18} />} onClick={() => navigator.share({ title: "Cămara", text: `Te invit în gospodăria „${household.name}” din Cămara`, url: hh.invitationLink(created.token) }).catch(() => {})}>
                  Trimite
                </Button>
              )}
            </div>
          ) : (
            <Button
              block
              onClick={() =>
                act(async () => {
                  setCreated(await hh.createInvitation(household.id, inviteRole, inviteEmail || null));
                })
              }
            >
              Creează linkul de invitație
            </Button>
          )
        }
      >
        {created ? (
          <div className="flex flex-col gap-2">
            <p className="text-[15px]">Trimite acest link persoanei invitate. E valabil 7 zile și poate fi folosit o singură dată.</p>
            <p className="break-all rounded-xl bg-surface-2 p-3 font-mono text-xs">{hh.invitationLink(created.token)}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {household.role === "owner" && (
              <Segmented
                label="Rolul"
                value={inviteRole}
                onChange={setInviteRole}
                options={[
                  { value: "member", label: "Membru" },
                  { value: "admin", label: "Administrator" },
                ]}
              />
            )}
            <LabeledInput
              label="Email (opțional)"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              hint="Dacă îl completezi, doar contul cu acest email poate folosi invitația."
            />
            <p className="text-xs text-ink-2">Membrii văd și modifică listele, planul, cămara și bugetul. Administratorii pot și invita sau scoate membri.</p>
          </div>
        )}
      </Sheet>

      <MemberSheet member={selected} onClose={() => setSelected(null)} onAct={act} />
    </>
  );
}

function MemberSheet({ member, onClose, onAct }: { member: hh.Member | null; onClose: () => void; onAct: (fn: () => Promise<unknown>, ok?: string) => Promise<void> }) {
  const app = useApp();
  const router = useRouter();
  const household = app.household!;
  const [confirm, setConfirm] = useState<null | "leave" | "remove" | "transfer">(null);
  if (!member) return null;
  const self = member.user_id === app.userId;
  const iAmOwner = household.role === "owner";
  const canRemove = !self && member.role !== "owner" && (iAmOwner || (household.role === "admin" && member.role === "member"));

  return (
    <>
      <Sheet open onClose={onClose} title={member.display_name}>
        <div className="flex flex-col gap-2">
          <p className="mb-2 text-sm text-ink-2">{ROLE_LABELS[member.role]}</p>
          {iAmOwner && !self && member.role !== "owner" && (
            <Button variant="secondary" onClick={() => onAct(() => hh.setMemberRole(household.id, member.user_id, member.role === "admin" ? "member" : "admin"), "Rolul a fost schimbat.").then(onClose)}>
              {member.role === "admin" ? "Fă-l membru simplu" : "Fă-l administrator"}
            </Button>
          )}
          {iAmOwner && !self && (
            <Button variant="secondary" icon={<Crown size={18} />} onClick={() => setConfirm("transfer")}>
              Predă gospodăria (devine proprietar)
            </Button>
          )}
          {canRemove && (
            <Button variant="danger" icon={<UserMinus size={18} />} onClick={() => setConfirm("remove")}>
              Scoate din gospodărie
            </Button>
          )}
          {self && member.role !== "owner" && (
            <Button variant="danger" icon={<LogOut size={18} />} onClick={() => setConfirm("leave")}>
              Părăsește gospodăria
            </Button>
          )}
          {self && member.role === "owner" && <p className="text-sm text-ink-2">Ca proprietar, nu poți părăsi gospodăria. Predă-o întâi altui membru sau șterge-o.</p>}
        </div>
      </Sheet>
      <ConfirmSheet
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        title={confirm === "leave" ? "Părăsești gospodăria?" : confirm === "remove" ? `Îl scoți pe ${member.display_name}?` : "Predai gospodăria?"}
        message={
          confirm === "leave"
            ? "Nu vei mai vedea listele, planul și bugetul acestei gospodării. Poți reveni doar cu o invitație nouă."
            : confirm === "remove"
              ? "Nu va mai vedea datele gospodăriei. Ce a adăugat rămâne."
              : `${member.display_name} devine proprietar, iar tu rămâi administrator.`
        }
        confirmLabel={confirm === "leave" ? "Părăsește" : confirm === "remove" ? "Scoate" : "Predă"}
        onConfirm={async () => {
          if (confirm === "leave") {
            await onAct(() => hh.removeMember(household.id, member.user_id), "Ai părăsit gospodăria.");
            await app.refreshHouseholds();
            router.push("/");
          } else if (confirm === "remove") await onAct(() => hh.removeMember(household.id, member.user_id), "Membrul a fost scos.");
          else {
            await onAct(() => hh.transferOwnership(household.id, member.user_id), "Gospodăria a fost predată.");
            await app.refreshHouseholds();
          }
          onClose();
        }}
      />
    </>
  );
}

function Places() {
  const { run } = useAction();
  const [editing, setEditing] = useState<Retailer | "nou" | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RetailerKind>("piata");
  const [details, setDetails] = useState("");
  const places = useData(async (ctx) => (await owned(ctx.db, "retailers", ctx.householdId)).sort((a, b) => a.name.localeCompare(b.name, "ro")));
  if (!places) return null;
  const KIND = { piata: "Piață", producator: "Producător local", alta: "Alt loc" } as Record<string, string>;
  return (
    <>
      {places.length > 0 && (
        <ul className="mb-3 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
          {places.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => {
                  setEditing(p);
                  setName(p.name);
                  setKind(p.kind);
                  setDetails(p.details ?? "");
                }}
                className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left"
              >
                <MapPin size={18} className="text-ink-2" />
                <span className="flex-1">
                  <span className="block">{p.name}</span>
                  {p.details && <span className="block text-xs text-ink-2">{p.details}</span>}
                </span>
                <Badge>{KIND[p.kind] ?? "Magazin"}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button
        variant="secondary"
        icon={<Plus size={18} />}
        onClick={() => {
          setEditing("nou");
          setName("");
          setKind("piata");
          setDetails("");
        }}
      >
        Adaugă o piață sau un producător
      </Button>
      <Sheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "nou" ? "Loc nou de cumpărături" : "Modifică"}
        footer={
          <div className="flex gap-2">
            {editing && editing !== "nou" && (
              <Button
                variant="danger"
                icon={<Trash2 size={18} />}
                aria-label="Șterge"
                onClick={async () => {
                  await run((ctx) => deleteRetailer(ctx, (editing as Retailer).id));
                  setEditing(null);
                }}
              />
            )}
            <Button
              block
              onClick={async () => {
                const ok = await run(async (ctx) => {
                  if (editing === "nou") await createRetailer(ctx, { name, kind, details: details || null });
                  else await updateRetailer(ctx, (editing as Retailer).id, { name, kind, details: details || null });
                  return true;
                });
                if (ok) setEditing(null);
              }}
            >
              Salvează
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <LabeledInput label="Numele" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="ex. Piața Obor sau Ion, ouă de țară" autoFocus />
          <LabeledSelect label="Tipul" value={kind} onChange={(e) => setKind(e.target.value as RetailerKind)}>
            <option value="piata">Piață</option>
            <option value="producator">Producător local</option>
            <option value="supermarket">Magazin</option>
            <option value="alta">Alt loc</option>
          </LabeledSelect>
          <LabeledInput label="Detalii (opțional)" value={details} onChange={(e) => setDetails(e.target.value)} maxLength={300} placeholder="ex. taraba 12, sâmbăta dimineața" />
        </div>
      </Sheet>
    </>
  );
}

function Settings() {
  const { run } = useAction();
  const toast = useToast();
  // Se afișează doar pe client (AppShell așteaptă încărcarea), deci putem citi direct preferințele locale.
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [notify, setNotify] = useState(expiryNotificationsEnabled);
  const settings = useData(async (ctx) => (await ctx.db.household_settings.get(ctx.householdId)) ?? null);
  return (
    <Card className="flex flex-col gap-4 p-4">
      <div>
        <p className="mb-2 text-sm text-ink-2">Aspect</p>
        <Segmented<Theme>
          label="Tema"
          value={theme}
          onChange={(t) => {
            setTheme(t);
            setThemeState(t);
          }}
          options={[
            { value: "sistem", label: "Automat" },
            { value: "luminos", label: "Luminos" },
            { value: "intunecat", label: "Întunecat" },
          ]}
        />
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-2">După cumpărături, alimentele intră în cămară</p>
        <Segmented<PantryOnPurchase>
          label="Cămara după cumpărături"
          value={settings?.pantry_on_purchase ?? "intreaba"}
          onChange={(v) => void run((ctx) => setPantryOnPurchase(ctx, v))}
          options={[
            { value: "intreaba", label: "Întreabă-mă" },
            { value: "mereu", label: "Mereu" },
            { value: "niciodata", label: "Niciodată" },
          ]}
        />
      </div>
      <Toggle
        checked={notify}
        onChange={async (v) => {
          if (v) {
            const ok = await enableExpiryNotifications();
            setNotify(ok);
            if (!ok) toast("Browserul nu permite notificările. Le poți activa din setările lui.", { tone: "error" });
          } else {
            disableExpiryNotifications();
            setNotify(false);
          }
        }}
        label="Anunță-mă când expiră ceva"
        description="O notificare pe zi, când deschizi aplicația, pe acest telefon."
      />
    </Card>
  );
}

function HouseholdScreen() {
  const app = useApp();
  const router = useRouter();
  const toast = useToast();
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [creatingAnother, setCreatingAnother] = useState(false);
  const [profileName, setProfileName] = useState(app.displayName ?? "");

  if (app.status === "no_household") {
    return (
      <>
        <PageHeader title="Bine ai venit!" subtitle="Creează gospodăria în care vei ține listele, rețetele și bugetul." />
        <Card className="p-4">
          <CreateHousehold first />
        </Card>
        <p className="mt-4 text-sm text-ink-2">Ai primit o invitație? Deschide linkul primit și vei intra direct în gospodăria respectivă.</p>
        <Button variant="ghost" className="mt-6" icon={<LogOut size={18} />} onClick={() => app.signOut()}>
          Ieși din cont
        </Button>
      </>
    );
  }

  const household = app.household!;
  const cloud = app.mode === "cloud";

  async function download() {
    if (!app.ctx) return;
    const json = await exportHouseholdData(app.ctx);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    a.download = `camara-${household.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <>
      <PageHeader title="Gospodărie și setări" subtitle={app.email ?? undefined} />

      <SectionTitle>Gospodăria</SectionTitle>
      <Card className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-lg font-semibold">{household.name}</p>
            <p className="text-sm text-ink-2">Rolul tău: {ROLE_LABELS[household.role]}</p>
          </div>
          {cloud && household.role !== "member" && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setNewName(household.name);
                setRenaming(true);
              }}
            >
              Redenumește
            </Button>
          )}
        </div>
        {app.households.length > 1 && (
          <div className="mt-4">
            <LabeledSelect label="Gospodăria activă" value={household.id} onChange={(e) => app.switchHousehold(e.target.value)}>
              {app.households.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </LabeledSelect>
          </div>
        )}
        {cloud && (
          <Button variant="ghost" size="sm" className="mt-3" icon={<Plus size={16} />} onClick={() => setCreatingAnother(true)}>
            Altă gospodărie
          </Button>
        )}
      </Card>

      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Users size={14} /> Membri
        </span>
      </SectionTitle>
      {cloud ? <Members /> : <p className="text-sm text-ink-2">În modul demonstrativ nu există conturi. Membrii și invitațiile funcționează după configurarea Supabase.</p>}

      <SectionTitle>Piețe și producători</SectionTitle>
      <p className="mb-2 text-sm text-ink-2">Locurile tale de cumpărături, pe lângă lanțurile de magazine. Le alegi la produse și la prețuri.</p>
      <Places />

      <SectionTitle>
        <span className="inline-flex items-center gap-1.5">
          <Bell size={14} /> Setări
        </span>
      </SectionTitle>
      <Settings />

      <SectionTitle>Datele tale</SectionTitle>
      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm text-ink-2">Descarcă o copie a datelor gospodăriei (liste, cumpărături, prețuri, plan, cămară, bugete), ca fișier JSON.</p>
        <Button variant="secondary" icon={<Download size={18} />} onClick={download}>
          Descarcă datele
        </Button>
        {app.isAppAdmin && (
          <Link href="/admin/" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-line font-medium hover:bg-surface-2">
            <Shield size={18} /> Administrarea catalogului
          </Link>
        )}
      </Card>

      {cloud && (
        <>
          <SectionTitle>Contul tău</SectionTitle>
          <Card className="flex flex-col gap-3 p-4">
            <LabeledInput label="Numele afișat" value={profileName} onChange={(e) => setProfileName(e.target.value)} maxLength={60} />
            <Button
              variant="secondary"
              icon={<Check size={18} />}
              onClick={async () => {
                try {
                  await hh.updateDisplayName(app.userId!, profileName);
                  toast("Numele a fost salvat.");
                } catch (e) {
                  toast(e instanceof UserError ? e.message : "Nu a mers.", { tone: "error" });
                }
              }}
            >
              Salvează numele
            </Button>
            <Button variant="ghost" icon={<LogOut size={18} />} onClick={() => app.signOut()}>
              Ieși din cont
            </Button>
            {household.role === "owner" && (
              <Button variant="danger" icon={<Trash2 size={18} />} onClick={() => setDeleting(true)}>
                Șterge gospodăria
              </Button>
            )}
          </Card>
        </>
      )}

      <Sheet open={renaming} onClose={() => setRenaming(false)} title="Redenumește gospodăria" footer={
        <Button
          block
          onClick={async () => {
            try {
              await hh.renameHousehold(household.id, newName);
              await app.refreshHouseholds();
              setRenaming(false);
            } catch (e) {
              toast(e instanceof UserError ? e.message : "Nu a mers.", { tone: "error" });
            }
          }}
        >
          Salvează
        </Button>
      }>
        <LabeledInput label="Numele" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} autoFocus />
      </Sheet>

      <Sheet open={creatingAnother} onClose={() => setCreatingAnother(false)} title="Gospodărie nouă">
        <CreateHousehold first={false} />
      </Sheet>

      <Sheet
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Ștergi definitiv gospodăria?"
        footer={
          <Button
            block
            variant="danger"
            disabled={confirmName.trim() !== household.name}
            onClick={async () => {
              try {
                await hh.deleteHousehold(household.id);
                setDeleting(false);
                await app.refreshHouseholds();
                router.push("/");
              } catch (e) {
                toast(e instanceof UserError ? e.message : "Nu a mers.", { tone: "error" });
              }
            }}
          >
            Șterge definitiv
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-[15px]">
          <p>
            Se șterg pentru toți membrii, fără posibilitate de recuperare: listele, istoricul cumpărăturilor, prețurile, planul, cămara și bugetele. Descarcă întâi o copie a datelor, dacă vrei să le păstrezi.
          </p>
          <LabeledInput label={`Scrie „${household.name}” ca să confirmi`} value={confirmName} onChange={(e) => setConfirmName(e.target.value)} />
        </div>
      </Sheet>
    </>
  );
}

export default function Page() {
  return (
    <AppShell>
      <HouseholdScreen />
    </AppShell>
  );
}
