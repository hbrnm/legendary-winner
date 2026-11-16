export type CaptureRequest = { mode: "manual" | "scan" | "shopping"; listId?: string };
export function dispatchCapture(request: CaptureRequest) {
  window.dispatchEvent(new CustomEvent<CaptureRequest>("camara:capture", { detail: request }));
}
