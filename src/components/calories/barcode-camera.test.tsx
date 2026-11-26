// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BarcodeCamera } from "./barcode-camera";

const decode = vi.hoisted(() => vi.fn());
vi.mock("@zxing/browser", () => ({
  BrowserMultiFormatOneDReader: class {
    decodeFromStream = decode;
  },
}));

const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");

function mockCamera() {
  const stopTrack = vi.fn();
  const getUserMedia = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return { stopTrack, getUserMedia };
}

afterEach(() => {
  cleanup();
  decode.mockReset();
  if (original) Object.defineProperty(navigator, "mediaDevices", original);
  else Reflect.deleteProperty(navigator, "mediaDevices");
});

it("completează doar un cod valid și oprește camera după citire", async () => {
  const { stopTrack } = mockCamera();
  const onRead = vi.fn();
  const stop = vi.fn();
  decode.mockResolvedValue({ stop });
  render(<BarcodeCamera onRead={onRead} onClose={vi.fn()} />);
  await waitFor(() => expect(decode).toHaveBeenCalledOnce());
  const onResult = decode.mock.calls[0][2];
  act(() => {
    onResult({ getText: () => "5949084024839" }, null, { stop });
    onResult({ getText: () => "5949084024838" }, null, { stop });
    onResult({ getText: () => "5949084024838" }, null, { stop });
  });
  expect(onRead).toHaveBeenCalledExactlyOnceWith("5949084024838");
  expect(stop).toHaveBeenCalled();
  expect(stopTrack).toHaveBeenCalled();
});

it("permite închiderea și introducerea manuală dacă permisiunea este refuzată", async () => {
  const { getUserMedia } = mockCamera();
  getUserMedia.mockRejectedValue(new DOMException("Permission denied", "NotAllowedError"));
  const onClose = vi.fn();
  render(<BarcodeCamera onRead={vi.fn()} onClose={onClose} />);
  expect((await screen.findByRole("alert")).textContent).toContain("introdu codul manual");
  fireEvent.click(screen.getByRole("button", { name: "Închide camera" }));
  expect(onClose).toHaveBeenCalledOnce();
});
