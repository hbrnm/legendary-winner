"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { CamaraDB } from "@/lib/db/database";
import { getMeta, setMeta } from "@/lib/db/database";
import type { AppCtx } from "@/lib/services/context";
import { DEMO_HOUSEHOLD_ID, DEMO_USER_ID, ensureDemoHousehold, openDatabase, seedCatalog } from "@/lib/services/bootstrap";
import { isCloudConfigured, supabase } from "@/lib/supabase/client";
import { SyncEngine, serverMissingKey, type SyncStatus } from "@/lib/sync/engine";
import { useLiveQuery } from "dexie-react-hooks";
import { SupabaseFiles, SupabaseRemote } from "@/lib/sync/supabase-remote";
import { browserPhotoCache, type PhotoCache, type RemoteFiles } from "@/lib/sync/files";
import type { Role } from "@/lib/domain/types";

export interface HouseholdInfo {
  id: string;
  name: string;
  role: Role;
}

export type AppStatus = "loading" | "signed_out" | "no_household" | "ready" | "error";

export interface AppState {
  status: AppStatus;
  mode: "demo" | "cloud";
  error: string | null;
  userId: string | null;
  email: string | null;
  displayName: string | null;
  households: HouseholdInfo[];
  household: HouseholdInfo | null;
  isAppAdmin: boolean;
  db: CamaraDB | null;
  ctx: AppCtx | null;
  sync: SyncStatus | null;
  /** Fotografiile gospodăriei: Storage și cache (null în modul demonstrativ); `enabled` după ce serverul are tabelul. */
  photos: { files: RemoteFiles | null; cache: PhotoCache | null; enabled: boolean };
  switchHousehold: (id: string) => Promise<void>;
  refreshHouseholds: () => Promise<void>;
  syncNow: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppContext);
  if (!v) throw new Error("useApp în afara AppProvider");
  return v;
}

/** Contextul pentru servicii; disponibil doar când gospodăria e încărcată. */
export function useCtx(): AppCtx {
  const { ctx } = useApp();
  if (!ctx) throw new Error("Gospodăria nu e încărcată");
  return ctx;
}

async function loadHouseholds(userId: string, db: CamaraDB): Promise<HouseholdInfo[]> {
  try {
    const { data, error } = await supabase().from("household_members").select("role, households(id, name)").eq("user_id", userId);
    if (error) throw error;
    const list = (data ?? [])
      .map((r) => {
        const h = r.households as unknown as { id: string; name: string } | null;
        return h ? { id: h.id, name: h.name, role: r.role as Role } : null;
      })
      .filter((x): x is HouseholdInfo => x !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "ro"));
    await setMeta(db, "households", list);
    return list;
  } catch {
    // Offline: folosim ce știm de la ultima conexiune.
    return (await getMeta<HouseholdInfo[]>(db, "households")) ?? [];
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const mode: "demo" | "cloud" = isCloudConfigured ? "cloud" : "demo";
  const [status, setStatus] = useState<AppStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; email: string | null; name: string | null } | null>(null);
  const [db, setDb] = useState<CamaraDB | null>(null);
  const [households, setHouseholds] = useState<HouseholdInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAppAdmin, setIsAppAdmin] = useState(false);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const engineRef = useRef<SyncEngine | null>(null);
  // Storage și cache doar în browser, în modul cu cont.
  const photoStore = useMemo(
    () => (mode === "cloud" && typeof window !== "undefined" ? { files: new SupabaseFiles(supabase()), cache: browserPhotoCache() } : { files: null, cache: null }),
    [mode],
  );

  // Pornire: modul demonstrativ sau sesiunea Supabase.
  useEffect(() => {
    let cancelled = false;
    async function startDemo() {
      const d = openDatabase("camara-demo");
      await seedCatalog(d);
      await ensureDemoHousehold(d);
      if (cancelled) return;
      setDb(d);
      setUser({ id: DEMO_USER_ID, email: null, name: null });
      setHouseholds([{ id: DEMO_HOUSEHOLD_ID, name: "Gospodăria mea", role: "owner" }]);
      setActiveId(DEMO_HOUSEHOLD_ID);
      setIsAppAdmin(true);
      setStatus("ready");
    }

    async function startCloud(userId: string, email: string | null) {
      const d = openDatabase(`camara-${userId}`);
      await seedCatalog(d);
      const list = await loadHouseholds(userId, d);
      let preferred = (await getMeta<string>(d, "active_household")) ?? null;
      try {
        const [{ data: prefs }, { data: admin }, { data: profile }] = await Promise.all([
          supabase().from("user_preferences").select("active_household_id").eq("user_id", userId).maybeSingle(),
          supabase().from("app_admins").select("user_id").eq("user_id", userId).maybeSingle(),
          supabase().from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        ]);
        preferred = (prefs?.active_household_id as string | null) ?? preferred;
        await setMeta(d, "is_app_admin", Boolean(admin));
        await setMeta(d, "display_name", profile?.display_name ?? null);
      } catch {
        /* offline */
      }
      if (cancelled) return;
      const active = list.find((h) => h.id === preferred) ?? list[0] ?? null;
      setDb(d);
      setUser({ id: userId, email, name: (await getMeta<string>(d, "display_name")) ?? null });
      setIsAppAdmin(Boolean(await getMeta<boolean>(d, "is_app_admin")));
      setHouseholds(list);
      setActiveId(active?.id ?? null);
      setStatus(active ? "ready" : "no_household");
    }

    if (mode === "demo") {
      startDemo().catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });
      return () => {
        cancelled = true;
      };
    }

    const client = supabase();
    // undefined = încă nu știm; null = nimeni autentificat.
    let currentUser: string | null | undefined = undefined;
    const handle = (session: { user: { id: string; email?: string | null } } | null) => {
      const uid = session?.user.id ?? null;
      if (uid === currentUser) return;
      currentUser = uid;
      if (!uid) {
        setDb(null);
        setUser(null);
        setStatus("signed_out");
        return;
      }
      setStatus("loading");
      startCloud(uid, session?.user.email ?? null).catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });
    };
    client.auth.getSession().then(({ data }) => handle(data.session));
    const { data: sub } = client.auth.onAuthStateChange((_event, session) => handle(session));
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [mode]);

  // Sincronizarea: la pornire, la revenirea conexiunii, la revenirea în aplicație, periodic și la notificări în timp real.
  useEffect(() => {
    if (mode !== "cloud" || !db || !activeId) return;
    const engine = new SyncEngine(db, new SupabaseRemote(supabase()), { files: photoStore.files ?? undefined, cache: photoStore.cache });
    engineRef.current = engine;
    const off = engine.onStatus(setSync);
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void engine.syncNow(), 400);
    };
    void engine.syncNow();
    const onVisible = () => document.visibilityState === "visible" && soon();
    window.addEventListener("online", soon);
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(soon, 60_000);
    const unsubscribe = new SupabaseRemote(supabase()).subscribe(activeId, soon);
    // Orice scriere locală pornește trimiterea (cu o mică întârziere, ca să grupăm modificările).
    const onLocalWrite = () => soon();
    db.outbox.hook("creating", onLocalWrite);
    return () => {
      off();
      unsubscribe();
      db.outbox.hook("creating").unsubscribe(onLocalWrite);
      window.removeEventListener("online", soon);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
      if (timer) clearTimeout(timer);
      engineRef.current = null;
    };
  }, [mode, db, activeId, photoStore]);

  // Pe producție, butonul de fotografie apare abia după ce serverul are tabelul (migrația aplicată).
  const photosMissing = useLiveQuery(async () => (db ? ((await getMeta<boolean>(db, serverMissingKey("recipe_photos"))) ?? null) : null), [db]);
  const photos = useMemo(() => ({ ...photoStore, enabled: mode === "demo" || photosMissing === false }), [photoStore, mode, photosMissing]);

  const household = households.find((h) => h.id === activeId) ?? null;

  const ctx = useMemo<AppCtx | null>(
    () => (db && user && household ? { db, householdId: household.id, userId: user.id, sync: mode === "cloud" } : null),
    [db, user, household, mode],
  );

  const refreshHouseholds = useCallback(async () => {
    if (mode !== "cloud" || !db || !user) return;
    const list = await loadHouseholds(user.id, db);
    setHouseholds(list);
    const active = list.find((h) => h.id === activeId) ?? list[0] ?? null;
    setActiveId(active?.id ?? null);
    setStatus(active ? "ready" : "no_household");
    await engineRef.current?.syncNow();
  }, [mode, db, user, activeId]);

  const switchHousehold = useCallback(
    async (id: string) => {
      setActiveId(id);
      setStatus("ready");
      if (db) await setMeta(db, "active_household", id);
      if (mode === "cloud" && user) {
        await supabase().from("user_preferences").upsert({ user_id: user.id, active_household_id: id });
      }
    },
    [db, mode, user],
  );

  const signOut = useCallback(async () => {
    if (mode !== "cloud") return;
    const current = db;
    await supabase().auth.signOut();
    // Datele gospodăriei nu rămân pe dispozitiv după deconectare.
    if (current) {
      current.close();
      await current.delete();
    }
  }, [mode, db]);

  const value: AppState = {
    status,
    mode,
    error,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    displayName: user?.name ?? null,
    households,
    household,
    isAppAdmin,
    db,
    ctx,
    sync,
    photos,
    switchHousehold,
    refreshHouseholds,
    syncNow: async () => {
      await engineRef.current?.syncNow();
    },
    signOut,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
