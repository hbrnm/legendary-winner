import type { Crop } from '@/lib/domain/receipt-crop';
import { prepareCanvas } from './receipt-pixels';

/** Keep the original bitmap alive for crop corrections and subsequent attempts. */
export async function prepareReceipt(image: ImageBitmap, crop: Crop): Promise<Blob> {
  let worker: Worker | undefined;
  let copy: ImageBitmap | undefined;
  try {
    if (typeof Worker !== 'undefined') {
      copy = await createImageBitmap(image);
      worker = new Worker(new URL('./receipt-pixels.worker.ts', import.meta.url), { type: 'module' });
      const active = worker;
      return await new Promise<Blob>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Receipt preparation timed out')), 30_000);
        const finish = (error?: Error, blob?: Blob) => {
          clearTimeout(timeout);
          if (error) reject(error);
          else resolve(blob!);
        };
        active.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
          if (event.data.blob instanceof Blob) finish(undefined, event.data.blob);
          else finish(new Error('Receipt preparation failed'));
        };
        active.onerror = (event) => { event.preventDefault(); finish(new Error('Receipt worker failed')); };
        active.onmessageerror = () => finish(new Error('Invalid receipt worker response'));
        try {
          active.postMessage({ image: copy, crop }, [copy!]);
          copy = undefined; // ownership transferred to the worker
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });
    }
  } catch {
    // A browser restriction or worker failure must not prevent offline reading.
  } finally {
    worker?.terminate();
    copy?.close();
  }
  // Let the pending progress indicator paint before the synchronous fallback.
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  return prepareCanvas(image, crop).convertToBlob({ type: 'image/png' });
}
