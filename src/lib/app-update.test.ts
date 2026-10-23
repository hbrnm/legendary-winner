import { afterEach, describe, expect, it, vi } from "vitest";
import { checkForUpdates, watchUpdates } from "./app-update";

function fakeContainer(controller: object | null) {
  const listeners = new Set<() => void>();
  return {
    controller,
    addEventListener: (_: "controllerchange", fn: () => void) => listeners.add(fn),
    removeEventListener: (_: "controllerchange", fn: () => void) => listeners.delete(fn),
    fire: () => listeners.forEach((fn) => fn()),
    count: () => listeners.size,
  };
}

describe("versiunea nouă a aplicației", () => {
  afterEach(() => vi.useRealTimers());

  it("anunță când o versiune nouă o înlocuiește pe cea care rula", () => {
    const sw = fakeContainer({});
    const onUpdate = vi.fn();
    watchUpdates(sw, onUpdate);
    sw.fire();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("nu anunță nimic la prima instalare (nu rula nicio versiune)", () => {
    const sw = fakeContainer(null);
    const onUpdate = vi.fn();
    watchUpdates(sw, onUpdate);
    sw.fire();
    expect(onUpdate).not.toHaveBeenCalled();
    sw.fire();
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it("se oprește la cerere", () => {
    const sw = fakeContainer({});
    const stop = watchUpdates(sw, vi.fn());
    stop();
    expect(sw.count()).toBe(0);
  });

  it("verifică la revenirea în aplicație și din oră în oră, doar cu internet", () => {
    vi.useFakeTimers();
    const update = vi.fn(() => Promise.resolve());
    const doc = new EventTarget() as EventTarget & { visibilityState: string };
    doc.visibilityState = "visible";
    let online = true;
    const stop = checkForUpdates({ update }, doc, () => online);

    doc.dispatchEvent(new Event("visibilitychange"));
    expect(update).toHaveBeenCalledTimes(1);
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(update).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(2);
    online = false;
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(2);

    stop();
    online = true;
    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
