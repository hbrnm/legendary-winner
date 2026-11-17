// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setClock } from "@/lib/clock";
import { useMealTime } from "./use-meal-time";

afterEach(() => { cleanup(); setClock(null); vi.useRealTimers(); });

it("trece de la prânz la gustare după ora telefonului, fără reîncărcare", () => {
  vi.useFakeTimers();
  setClock("2026-11-17T14:59:50+02:00");
  const { result } = renderHook(useMealTime);
  expect(result.current).toEqual({today:"2026-11-17",meal:"pranz"});
  setClock("2026-11-17T15:00:20+02:00");
  act(() => vi.advanceTimersByTime(30_000));
  expect(result.current.meal).toBe("gustare");
});

it("recitește ora și data la revenirea după miezul nopții și oprește ceasul la demontare", () => {
  vi.useFakeTimers();
  setClock("2026-11-17T23:59:00+02:00");
  const { result, unmount } = renderHook(useMealTime);
  setClock("2026-11-18T08:00:00+02:00");
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current).toEqual({today:"2026-11-18",meal:"mic_dejun"});
  setClock("2026-11-18T18:00:00+02:00");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(result.current.meal).toBe("cina");
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});
