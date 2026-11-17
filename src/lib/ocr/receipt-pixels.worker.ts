import type { Crop } from '@/lib/domain/receipt-crop';
import { prepareCanvas } from './receipt-pixels';

self.onmessage = async (event: MessageEvent<{ image: ImageBitmap; crop: Crop }>) => {
  const { image, crop } = event.data;
  try {
    const blob = await prepareCanvas(image, crop).convertToBlob({ type: 'image/png' });
    self.postMessage({ blob });
  } catch {
    self.postMessage({ error: 'Receipt preparation failed' });
  } finally {
    image.close();
  }
};
