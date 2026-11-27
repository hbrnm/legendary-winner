import { describe, expect, it, vi } from "vitest";
import { supabase } from "@/lib/supabase/client";
import { deleteAccount } from "./household";
import { UserError } from "./context";

vi.mock("@/lib/supabase/client", () => ({
  supabase: vi.fn(),
}));

describe("deleteAccount", () => {
  it("apelează funcția delete_my_account prin RPC și reușește", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({ data: [], error: null }).mockResolvedValueOnce({ error: null });
    vi.mocked(supabase).mockReturnValue({ rpc: rpcMock } as never);

    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(rpcMock).toHaveBeenNthCalledWith(1, "account_deletion_photo_paths");
    expect(rpcMock).toHaveBeenCalledWith("delete_my_account");
  });

  it("șterge fotografiile prin Storage înainte de eliminarea contului", async () => {
    const path = "household/recipe/photo.webp";
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: [path], error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ error: null });
    const remove = vi.fn().mockResolvedValue({ data: [{ name: path }], error: null });
    vi.mocked(supabase).mockReturnValue({ rpc, storage: { from: () => ({ remove }) } } as never);

    await expect(deleteAccount()).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith([path]);
    expect(remove.mock.invocationCallOrder[0]).toBeLessThan(rpc.mock.invocationCallOrder[2]);
  });

  it("arată mesajul în română dacă utilizatorul este proprietar într-o gospodărie cu mai mulți membri", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      error: {
        message: "Ești proprietarul gospodăriei „Familia”. Transferă dreptul de proprietate către alt membru înainte de a-ți șterge contul.",
        code: "22023",
      },
    });
    vi.mocked(supabase).mockReturnValue({ rpc: rpcMock } as never);

    await expect(deleteAccount()).rejects.toThrow(UserError);
    await expect(deleteAccount()).rejects.toThrow(
      "Ești proprietarul gospodăriei „Familia”. Transferă dreptul de proprietate către alt membru înainte de a-ți șterge contul.",
    );
  });

  it("semnalează lipsa conexiunii la internet", async () => {
    const rpcMock = vi.fn().mockResolvedValue({
      error: { message: "Failed to fetch" },
    });
    vi.mocked(supabase).mockReturnValue({ rpc: rpcMock } as never);

    await expect(deleteAccount()).rejects.toThrow(UserError);
    await expect(deleteAccount()).rejects.toThrow("Ai nevoie de internet pentru această acțiune.");
  });

  it("folosește mesajul fallback dacă apare o eroare neprevăzută", async () => {
    const rpcMock = vi.fn().mockResolvedValueOnce({ data: [], error: null }).mockResolvedValue({
      error: { message: "Internal server error", code: "500" },
    });
    vi.mocked(supabase).mockReturnValue({ rpc: rpcMock } as never);

    const deletion = deleteAccount();
    await expect(deletion).rejects.toThrow(UserError);
    await expect(deletion).rejects.toThrow("Nu am putut șterge contul.");
  });
});

