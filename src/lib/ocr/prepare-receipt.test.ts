import { afterEach, expect, it, vi } from 'vitest';
import { prepareReceipt } from './prepare-receipt';
const original = { width: 10, height: 10, close: vi.fn() } as unknown as ImageBitmap;
const crop = { x: 0, y: 0, width: 1, height: 1 };
afterEach(() => vi.unstubAllGlobals());
it('returns the prepared worker blob and terminates the worker without closing the original', async () => {
  const blob = new Blob(['prepared']);
  const terminate = vi.fn();
  const clone = { close: vi.fn() };
  vi.stubGlobal('createImageBitmap', async () => clone);
  vi.stubGlobal('Worker', class {
    onmessage: ((e: { data: unknown }) => void) | null = null;
    postMessage() { queueMicrotask(() => this.onmessage?.({ data: { blob } })); }
    terminate = terminate;
  });
  expect(await prepareReceipt(original, crop)).toBe(blob);
  expect(terminate).toHaveBeenCalledOnce();
  expect(original.close).not.toHaveBeenCalled();
});

it('falls back when workers are unavailable or fail, preserving the original bitmap', async () => {
  const blob = new Blob(['fallback']);
  const converted = vi.fn(async () => blob);
  vi.stubGlobal('OffscreenCanvas', class {
    getContext() { return {
      drawImage() {},
      getImageData: () => ({ data: new Uint8ClampedArray(1800 * 1800 * 4) }),
      putImageData() {},
    }; }
    convertToBlob = converted;
  });
  vi.stubGlobal('Worker', undefined);
  expect(await prepareReceipt(original, crop)).toBe(blob);
  const terminate = vi.fn();
  const clone = { close: vi.fn() };
  vi.stubGlobal('createImageBitmap', async () => clone);
  vi.stubGlobal('Worker', class {
    onerror: ((event: { preventDefault(): void }) => void) | null = null;
    postMessage() { queueMicrotask(() => this.onerror?.({ preventDefault() {} })); }
    terminate = terminate;
  });
  expect(await prepareReceipt(original, crop)).toBe(blob);
  expect(terminate).toHaveBeenCalledOnce();
  expect(converted).toHaveBeenCalledTimes(2);
  expect(original.close).not.toHaveBeenCalled();
});
