// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ListActionsSheet } from "./list-actions-sheet";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
});

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const selectListMock = vi.fn();
vi.mock("./active-list-provider", () => ({
  useActiveShoppingList: () => ({
    selectList: selectListMock,
    activeListId: "l1",
    ready: true,
  }),
}));

const runMock = vi.fn();
vi.mock("@/components/app/hooks", () => ({
  useAction: () => ({ run: runMock, busy: false }),
  useData: () => ({
    listSources: [
      {
        source: { kind: "list", id: "l1" },
        title: "Lista veche",
        subtitle: "Listă de cumpărături",
      },
    ],
    txSources: [
      {
        source: { kind: "transaction", id: "t1" },
        title: "Cumpărături Kaufland",
        subtitle: "16 nov. · 150,00 RON",
      },
    ],
  }),
}));

vi.mock("@/lib/services/queries", () => ({
  owned: (_db: unknown, table: string) => {
    if (table === "shopping_lists") {
      return Promise.resolve([
        { id: "l1", name: "Lista veche", updated_at: "2026-11-17", is_recurring: false },
      ]);
    }
    if (table === "shopping_transactions") {
      return Promise.resolve([
        { id: "t1", completed_at: "2026-11-16T12:00:00Z", declared_total: 150 },
      ]);
    }
    return Promise.resolve([]);
  },
  visible: () => Promise.resolve([]),
}));

vi.mock("@/lib/services/shopping", () => ({
  copyShoppingSource: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("afișează listele și permite alegerea unei surse pentru copiere", async () => {
  const onClose = vi.fn();
  const { findByText, getByRole, getByLabelText } = render(
    <ListActionsSheet open={true} onClose={onClose} />
  );

  const listButton = await findByText("Lista veche");
  fireEvent.click(listButton);

  const input = getByLabelText("Numele noii liste") as HTMLInputElement;
  expect(input.value).toBe("Lista veche (copie)");

  runMock.mockResolvedValue("newList123");
  const createButton = getByRole("button", { name: "Creează copia" });
  fireEvent.click(createButton);

  await waitFor(() => {
    expect(runMock).toHaveBeenCalled();
    expect(selectListMock).toHaveBeenCalledWith("newList123");
    expect(onClose).toHaveBeenCalled();
    expect(pushMock).toHaveBeenCalledWith("/cumparaturi/lista/?id=newList123");
  });
});
