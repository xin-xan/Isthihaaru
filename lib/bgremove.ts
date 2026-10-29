/**
 * In-browser product cut-out using the U²-Net (u2netp) model on onnxruntime-web.
 * The runtime and model are served with the app (public/ort, public/models), so it costs nothing per photo.
 */

import { loadOrt, type Ort } from "./ort-loader";

type Session = import("onnxruntime-web").InferenceSession;

const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let sessionPromise: Promise<{ ort: Ort; session: Session }> | null = null;

function loadSession() {
  sessionPromise ??= (async () => {
    const ort = await loadOrt();
    // Threads need cross-origin isolation headers; a single thread is fast enough for a 320px mask.
    ort.env.wasm.numThreads = 1;
    const res = await fetch(new URL("models/u2netp.onnx", document.baseURI));
    if (!res.ok) throw new Error(`Model download failed (${res.status})`);
    const model = new Uint8Array(await res.arrayBuffer());
    const session = await ort.InferenceSession.create(model, { executionProviders: ["wasm"] });
    return { ort, session };
  })().catch((err) => {
    sessionPromise = null;
    throw err;
  });
  return sessionPromise;
}

/** Starts downloading the model early so the first cut-out is quicker. */
export function preloadBackgroundRemover() {
  void loadSession().catch(() => {});
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the photo."));
    img.src = src;
  });
}

/** Returns a PNG data URL of the product with a transparent background, trimmed to its bounds. */
export async function removeBackground(photoUrl: string): Promise<string> {
  const [{ ort, session }, img] = await Promise.all([loadSession(), loadImage(photoUrl)]);

  const small = document.createElement("canvas");
  small.width = small.height = SIZE;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.drawImage(img, 0, 0, SIZE, SIZE);
  const px = sctx.getImageData(0, 0, SIZE, SIZE).data;
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    for (let c = 0; c < 3; c++) input[c * plane + i] = (px[i * 4 + c] / 255 - MEAN[c]) / STD[c];
  }

  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  const pred = out[session.outputNames[0]].data as Float32Array;
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of pred) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const mask = sctx.createImageData(SIZE, SIZE);
  for (let i = 0; i < plane; i++) {
    const v = (pred[i] - lo) / (hi - lo || 1);
    // Firm up the soft matte so edges look crisp after upscaling.
    mask.data[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, (v - 0.1) / 0.8)));
  }
  sctx.putImageData(mask, 0, 0);

  const full = document.createElement("canvas");
  full.width = img.width;
  full.height = img.height;
  const fctx = full.getContext("2d", { willReadFrequently: true })!;
  fctx.drawImage(img, 0, 0);
  fctx.globalCompositeOperation = "destination-in";
  fctx.imageSmoothingQuality = "high";
  fctx.drawImage(small, 0, 0, full.width, full.height);

  // Trim to the visible product so placement can stand it on its base.
  const { data, width, height } = fctx.getImageData(0, 0, full.width, full.height);
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("Couldn't find the product in this photo. Try a clearer photo with the product in the middle.");
  const trimmed = document.createElement("canvas");
  trimmed.width = x1 - x0 + 1;
  trimmed.height = y1 - y0 + 1;
  trimmed.getContext("2d")!.drawImage(full, x0, y0, trimmed.width, trimmed.height, 0, 0, trimmed.width, trimmed.height);
  return trimmed.toDataURL("image/png");
}
