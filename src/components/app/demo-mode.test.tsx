// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { AppProvider, useApp, type AppState } from "./app-provider";
import { DEMO_MODE_KEY } from "@/lib/app-mode";
import { CamaraDB } from "@/lib/db/database";
import AuthPage from "@/app/autentificare/page";

const cloud = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ data: { session: null } })),
  unsubscribe: vi.fn(),
  client: vi.fn(),
  signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
  resetPasswordForEmail: vi.fn(async () => ({ error: null })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: () => {} }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));
vi.mock("@/lib/supabase/client", () => ({
  isCloudConfigured: true,
  supabase: cloud.client,
}));
let current: AppState;
function Probe() {
  const app = useApp();
  useEffect(() => { current = app; }, [app]);
  return <output>{app.status}</output>;
}

beforeEach(() => {
  localStorage.clear();
  cloud.client.mockReset().mockReturnValue({ auth: { getSession: cloud.getSession, signUp: cloud.signUp, resetPasswordForEmail: cloud.resetPasswordForEmail, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: cloud.unsubscribe } } }) } });
  cloud.getSession.mockClear();
  cloud.signUp.mockClear();
  cloud.resetPasswordForEmail.mockClear();
});
afterEach(async () => {
  cleanup();
  current?.db?.close();
  await new CamaraDB("camara-demo").delete();
});

describe("demo disponibil și când aplicația are Supabase configurat", () => {
  it("linkurile de confirmare și resetare cer explicit revenirea la cont", async () => {
    history.replaceState({}, "", "/autentificare/?demo=0&inapoi=%2Fplan%2F");
    const view = render(<AppProvider><Probe /><AuthPage /></AppProvider>);
    await waitFor(() => expect(current.status).toBe("signed_out"));
    fireEvent.click(view.getByRole("radio", { name: "Cont nou" }));
    fireEvent.change(view.getByLabelText("Numele tău"), { target: { value: "Ana" } });
    fireEvent.change(view.getByLabelText("Email"), { target: { value: "ana@exemplu.ro" } });
    fireEvent.change(view.getByLabelText("Parola"), { target: { value: "parola-de-test-123" } });
    fireEvent.click(view.getByRole("button", { name: "Creează contul" }));
    await waitFor(() => expect(cloud.signUp).toHaveBeenCalled());
    await view.findByText(/^Ți-am trimis un email de confirmare/);
    const signup = cloud.signUp.mock.calls[0] as unknown as [{ options: { emailRedirectTo: string } }];
    expect(new URL(signup[0].options.emailRedirectTo).searchParams.get("demo")).toBe("0");
    expect(new URL(signup[0].options.emailRedirectTo).searchParams.get("inapoi")).toBe("/plan/");
    fireEvent.click(view.getByRole("radio", { name: "Intră în cont" }));
    fireEvent.click(view.getByRole("button", { name: "Am uitat parola" }));
    fireEvent.click(view.getByRole("button", { name: "Trimite linkul" }));
    await waitFor(() => expect(cloud.resetPasswordForEmail).toHaveBeenCalled());
    const reset = cloud.resetPasswordForEmail.mock.calls[0] as unknown as [string, { redirectTo: string }];
    expect(new URL(reset[1].redirectTo).searchParams.get("demo")).toBe("0");
  });
  it("nu schimbă baza de date în timpul folosirii dacă preferința se modifică în altă filă", async () => {
    history.replaceState({}, "", "/?demo=1");
    const view = render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(current.status).toBe("ready"), { timeout: 4_000 });
    localStorage.removeItem(DEMO_MODE_KEY);
    history.replaceState({}, "", "/retete/");
    // O randare obișnuită nu trebuie să comute către cont peste datele demo.
    view.rerender(<AppProvider><Probe /></AppProvider>);
    expect(current.mode).toBe("demo");
    expect(current.db?.name).toBe("camara-demo");
    expect(current.ctx?.sync).toBe(false);
  });
  it("nici pagina de autentificare nu inițializează Supabase când demo este ales", async () => {
    history.replaceState({}, "", "/autentificare/?demo=1");
    const view = render(<AppProvider><Probe /><AuthPage /></AppProvider>);
    await waitFor(() => expect(current.status).toBe("ready"), { timeout: 4_000 });
    expect(cloud.client).not.toHaveBeenCalled();
    expect(view.queryByLabelText("Email")).toBeNull();
  });
  it("deschide gospodăria model fără client Supabase sau sincronizare", async () => {
    history.replaceState({}, "", "/?demo=1");
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(current.status).toBe("ready"), { timeout: 10_000 });
    expect(current.mode).toBe("demo");
    expect(current.db?.name).toBe("camara-demo");
    expect(current.ctx?.sync).toBe(false);
    expect(current.photos.files).toBeNull();
    expect(current.sync).toBeNull();
    expect(await current.db!.budgets.count()).toBeGreaterThan(0);
    expect(await current.db!.shopping_lists.count()).toBeGreaterThan(0);
    expect(cloud.client).not.toHaveBeenCalled();
  });
  it("reia demo pe o pagină interioară, fără a porni contul", async () => {
    localStorage.setItem(DEMO_MODE_KEY, "1");
    history.replaceState({}, "", "/retete/");
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(current.status).toBe("ready"), { timeout: 10_000 });
    expect(current.mode).toBe("demo");
    expect(cloud.client).not.toHaveBeenCalled();
  });
  it("linkul de ieșire revine la autentificare și lasă datele demo intacte", async () => {
    const demo = new CamaraDB("camara-demo");
    await demo.meta.put({ key: "demo-sentinel", value: "păstrat" });
    demo.close();
    localStorage.setItem(DEMO_MODE_KEY, "1");
    history.replaceState({}, "", "/autentificare/?demo=0");
    render(<AppProvider><Probe /></AppProvider>);
    await waitFor(() => expect(current.status).toBe("signed_out"));
    expect(current.mode).toBe("cloud");
    expect(current.db).toBeNull();
    expect(localStorage.getItem(DEMO_MODE_KEY)).toBeNull();
    const preserved = new CamaraDB("camara-demo");
    expect((await preserved.meta.get("demo-sentinel"))?.value).toBe("păstrat");
    preserved.close();
  });
});
