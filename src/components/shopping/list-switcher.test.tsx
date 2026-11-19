// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ListSwitcher } from "./list-switcher";

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
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

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("randează butonul de deschidere și comută lista aleasă", () => {
  const lists = [
    { id: "l1", name: "Lista 1" },
    { id: "l2", name: "Lista 2" },
  ];
  const { getByRole, getByText } = render(<ListSwitcher currentListId="l1" lists={lists} />);
  const trigger = getByRole("button", { name: "Comută lista de cumpărături" });
  fireEvent.click(trigger);

  const option2 = getByText("Lista 2");
  fireEvent.click(option2);

  expect(selectListMock).toHaveBeenCalledWith("l2");
  expect(pushMock).toHaveBeenCalledWith("/cumparaturi/lista/?id=l2");
});

it("navighează la crearea unei liste noi", () => {
  const lists = [{ id: "l1", name: "Lista 1" }];
  const { getByRole } = render(<ListSwitcher currentListId="l1" lists={lists} />);
  const trigger = getByRole("button", { name: "Comută lista de cumpărături" });
  fireEvent.click(trigger);

  const newBtn = getByRole("button", { name: "+ Listă nouă" });
  fireEvent.click(newBtn);

  expect(pushMock).toHaveBeenCalledWith("/cumparaturi/?nou=1");
});

it("navighează la toate listele", () => {
  const lists = [{ id: "l1", name: "Lista 1" }];
  const { getByRole } = render(<ListSwitcher currentListId="l1" lists={lists} />);
  const trigger = getByRole("button", { name: "Comută lista de cumpărături" });
  fireEvent.click(trigger);

  const allBtn = getByRole("button", { name: "Vezi toate listele" });
  fireEvent.click(allBtn);

  expect(pushMock).toHaveBeenCalledWith("/cumparaturi/?toate=1");
});
