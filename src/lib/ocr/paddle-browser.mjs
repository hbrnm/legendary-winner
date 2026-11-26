import { PaddleOCR } from "@paddleocr/paddleocr-js";
import { groupReceiptRows } from "./paddle-rows.mjs";

const assets = new URL("./", import.meta.url);
let engine;

globalThis.__camaraReadPaddle = async (canvas) => {
  engine ??= PaddleOCR.create({
    textDetectionModelName: "PP-OCRv6_tiny_det",
    textRecognitionModelName: "PP-OCRv6_tiny_rec",
    textDetectionModelAsset: { url: new URL("PP-OCRv6_tiny_det_onnx_infer.tar", assets).href },
    textRecognitionModelAsset: { url: new URL("PP-OCRv6_tiny_rec_onnx_infer.tar", assets).href },
    textDetectionBatchSize: 1,
    textRecognitionBatchSize: 2,
    ortOptions: { backend: "wasm", wasmPaths: assets.href, numThreads: 1 },
  }).catch(error => {
    engine = undefined;
    throw error;
  });
  const [prediction] = await (await engine).predict(canvas, { textDetLimitSideLen: 1600, textDetLimitType: "max" });
  return groupReceiptRows(prediction?.items ?? []).join("\n");
};
