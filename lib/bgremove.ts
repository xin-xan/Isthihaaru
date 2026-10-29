/**
 * Product cut-out, run in a Web Worker (lib/segment/worker.ts) so the page stays responsive.
 * A quick result arrives in ~2 s; when `best` is on, a cleaner ISNet result replaces it later.
 * Everything runs on the user's device, so it costs nothing per photo.
 */
import { SEGMENT_ASSETS } from "./segment/assets";
import type { WorkerResponse } from "./segment/types";

export type CutoutStage = "quick" | "best";

export interface CutoutHandlers {
  best: boolean;
  onResult: (stage: CutoutStage, pngUrl: string) => void;
  onImproving?: () => void;
  onError: (message: string, stage: CutoutStage) => void;
}

let worker: Worker | null = null;
let jobId = 0;
const jobs = new Map<number, { photo: string; handlers: CutoutHandlers; gotQuick: boolean }>();

function getWorker(): Worker {
  if (worker) return worker;
  const base = document.baseURI;
  worker = new Worker(new URL(SEGMENT_ASSETS.worker, base), { type: "module" });
  worker.postMessage({ type: "config", assets: { ...SEGMENT_ASSETS, base } });
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const job = jobs.get(msg.id);
    if (!job || msg.id !== jobId) return;
    if (msg.type === "status") job.handlers.onImproving?.();
    else if (msg.type === "error") {
      job.handlers.onError(msg.message, job.gotQuick ? "best" : "quick");
      jobs.delete(msg.id);
    } else {
      if (msg.stage === "quick") job.gotQuick = true;
      compose(job.photo, msg.width, msg.height, msg.alpha)
        .then((url) => job.handlers.onResult(msg.stage, url))
        .catch((err: Error) => job.handlers.onError(err.message, msg.stage));
      if (msg.stage === "best" || !job.handlers.best) jobs.delete(msg.id);
    }
  };
  worker.onerror = (e) => {
    for (const [id, job] of jobs) {
      job.handlers.onError(e.message || "Background removal stopped unexpectedly.", job.gotQuick ? "best" : "quick");
      jobs.delete(id);
    }
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the photo."));
    img.src = src;
  });
}

/** Applies the alpha mask to the photo and trims to the product's bounds. */
async function compose(photoUrl: string, W: number, H: number, alpha: Uint8ClampedArray): Promise<string> {
  const img = await loadImage(photoUrl);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, W, H);
  const data = x.getImageData(0, 0, W, H);
  let x0 = W;
  let y0 = H;
  let x1 = -1;
  let y1 = -1;
  for (let i = 0; i < alpha.length; i++) {
    data.data[i * 4 + 3] = alpha[i];
    if (alpha[i] > 24) {
      const px = i % W;
      const py = (i - px) / W;
      if (px < x0) x0 = px;
      if (px > x1) x1 = px;
      if (py < y0) y0 = py;
      if (py > y1) y1 = py;
    }
  }
  if (x1 < 0) throw new Error("Couldn't find the product in this photo. Try a clearer photo with the product in the middle.");
  x.putImageData(data, 0, 0);
  const t = document.createElement("canvas");
  t.width = x1 - x0 + 1;
  t.height = y1 - y0 + 1;
  t.getContext("2d")!.drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
  return t.toDataURL("image/png");
}

/** Starts a cut-out; results arrive through the handlers. Starting another cancels this one. */
export async function cutOutProduct(photoUrl: string, handlers: CutoutHandlers) {
  const id = ++jobId;
  jobs.clear();
  jobs.set(id, { photo: photoUrl, handlers, gotQuick: false });
  try {
    const blob = await (await fetch(photoUrl)).blob();
    getWorker().postMessage({ type: "segment", id, blob, best: handlers.best });
  } catch (err) {
    handlers.onError(err instanceof Error ? err.message : "Couldn't start background removal.", "quick");
  }
}
