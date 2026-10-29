/// <reference lib="webworker" />
/**
 * Background-removal worker. Runs off the main thread so the page never freezes:
 *  1. quick pass: small U²-Net (320px), then a second look at a crop around the product;
 *  2. best pass (optional): ISNet at 1024px on that crop.
 * Each pass is cleaned up (detached blobs removed, small holes filled) and its edges snapped
 * to the photo with a guided filter. Results are full-resolution alpha masks.
 */
import * as ortWasm from "onnxruntime-web/wasm";
import { cleanMask, dilate, guidedFilter, maskBounds, normalize } from "./postprocess";
import type { ModelAsset, SegmentAssets, WorkerRequest, WorkerResponse } from "./types";

type Ort = typeof import("onnxruntime-web");
type Session = import("onnxruntime-web").InferenceSession;

const ort = ortWasm as unknown as Ort;
const ctx = self as unknown as DedicatedWorkerGlobalScope;

let assets: SegmentAssets | null = null;
let runtime: Promise<void> | null = null;
const sessions = new Map<"quick" | "best", Promise<Session>>();
let latestJob = 0;

const MEAN = { imagenet: [0.485, 0.456, 0.406], half: [0.5, 0.5, 0.5] };
const STD = { imagenet: [0.229, 0.224, 0.225], half: [1, 1, 1] };

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  ctx.postMessage(msg, transfer);
}

async function fetchOk(url: string) {
  const res = await fetch(new URL(url, assets!.base));
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`);
  return res;
}

/** Loads a model; static hosts get base64 text, split into parts listed in a .json manifest. */
async function modelBytes(a: ModelAsset): Promise<Uint8Array> {
  if (a.encoding === "binary") return new Uint8Array(await (await fetchOk(a.url)).arrayBuffer());
  const parts: string[] = a.url.endsWith(".json") ? ((await (await fetchOk(a.url)).json()) as { parts: string[] }).parts : [a.url];
  const texts = await Promise.all(parts.map(async (p) => (await (await fetchOk(p)).text()).trim()));
  const bin = atob(texts.join(""));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function session(kind: "quick" | "best"): Promise<Session> {
  let s = sessions.get(kind);
  if (!s) {
    s = (async () => {
      runtime ??= (async () => {
        ort.env.wasm.wasmBinary = await (await fetchOk(assets!.wasm)).arrayBuffer();
        ort.env.wasm.numThreads = 1;
      })();
      await runtime;
      const bytes = await modelBytes(assets![kind]);
      return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });
    })();
    s.catch(() => sessions.delete(kind));
    sessions.set(kind, s);
  }
  return s;
}

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Runs a model on one region of the photo; returns its 0..1 mask at the model's size. */
async function infer(sess: Session, a: ModelAsset, photo: OffscreenCanvas, r: Region): Promise<Float32Array> {
  const S = a.size;
  const c = new OffscreenCanvas(S, S);
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.imageSmoothingQuality = "high";
  x.drawImage(photo, r.x, r.y, r.w, r.h, 0, 0, S, S);
  const px = x.getImageData(0, 0, S, S).data;
  const plane = S * S;
  const input = new Float32Array(3 * plane);
  const mean = MEAN[a.norm];
  const std = STD[a.norm];
  for (let i = 0; i < plane; i++) for (let ch = 0; ch < 3; ch++) input[ch * plane + i] = (px[i * 4 + ch] / 255 - mean[ch]) / std[ch];
  const out = await sess.run({ [sess.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, S, S]) });
  return normalize(out[sess.outputNames[0]].data as Float32Array);
}

/** Upscales a model-size mask into its region of a full-size mask (zero elsewhere). */
function place(mask: Float32Array, S: number, r: Region, W: number, H: number): Float32Array {
  const small = new OffscreenCanvas(S, S);
  const sx = small.getContext("2d")!;
  const img = sx.createImageData(S, S);
  for (let i = 0; i < S * S; i++) img.data[i * 4 + 3] = Math.round(mask[i] * 255);
  sx.putImageData(img, 0, 0);
  const big = new OffscreenCanvas(W, H);
  const bx = big.getContext("2d", { willReadFrequently: true })!;
  bx.imageSmoothingQuality = "high";
  bx.drawImage(small, 0, 0, S, S, r.x, r.y, r.w, r.h);
  const data = bx.getImageData(0, 0, W, H).data;
  const out = new Float32Array(W * H);
  for (let i = 0; i < out.length; i++) out[i] = data[i * 4 + 3] / 255;
  return out;
}

function expand(b: { x0: number; y0: number; x1: number; y1: number }, r: Region, margin: number, W: number, H: number): Region {
  const bw = (b.x1 - b.x0) * r.w;
  const bh = (b.y1 - b.y0) * r.h;
  const x0 = Math.max(0, r.x + b.x0 * r.w - bw * margin);
  const y0 = Math.max(0, r.y + b.y0 * r.h - bh * margin);
  const x1 = Math.min(W, r.x + b.x1 * r.w + bw * margin);
  const y1 = Math.min(H, r.y + b.y1 * r.h + bh * margin);
  return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
}

/** Snaps the mask to photo edges and firms up the matte. */
function finish(p: Float32Array, gray: Float32Array, W: number, H: number): Uint8ClampedArray {
  const r = Math.max(2, Math.round(Math.max(W, H) / 220));
  const q = guidedFilter(gray, p, W, H, r, 4e-4);
  const alpha = new Uint8ClampedArray(W * H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(255 * Math.min(1, Math.max(0, (q[i] - 0.1) / 0.8)));
  return alpha;
}

async function segment(id: number, blob: Blob, best: boolean) {
  const bmp = await createImageBitmap(blob);
  const W = bmp.width;
  const H = bmp.height;
  const photo = new OffscreenCanvas(W, H);
  const pctx = photo.getContext("2d", { willReadFrequently: true })!;
  pctx.drawImage(bmp, 0, 0);
  bmp.close();
  const rgba = pctx.getImageData(0, 0, W, H).data;
  const gray = new Float32Array(W * H);
  for (let i = 0; i < gray.length; i++) gray[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
  const whole: Region = { x: 0, y: 0, w: W, h: H };

  // Quick pass, then a second look at the product's crop for more detail.
  const quick = assets!.quick;
  const qs = await session("quick");
  const first = cleanMask(await infer(qs, quick, photo, whole), quick.size, quick.size);
  const bounds = maskBounds(first, quick.size, quick.size);
  if (!bounds) throw new Error("Couldn't find the product in this photo. Try a clearer photo with the product in the middle.");
  let low = first;
  let lowRegion = whole;
  const crop = expand(bounds, whole, 0.1, W, H);
  if (crop.w * crop.h < W * H * 0.7) {
    low = cleanMask(await infer(qs, quick, photo, crop), quick.size, quick.size);
    lowRegion = crop;
  }
  const mask = place(low, quick.size, lowRegion, W, H);
  if (id !== latestJob) return;
  const quickAlpha = finish(mask, gray, W, H);
  post({ type: "result", id, stage: "quick", width: W, height: H, alpha: quickAlpha }, [quickAlpha.buffer]);

  if (!best) return;
  post({ type: "status", id, stage: "best" });
  const bs = await session("best");
  if (id !== latestJob) return;
  const region = expand(bounds, whole, 0.15, W, H);
  const fine = cleanMask(await infer(bs, assets!.best, photo, region), assets!.best.size, assets!.best.size);
  if (id !== latestJob) return;
  // The detailed model can latch onto background shapes touching the product; keep only what lies
  // near the quick pass's result (grown by ~1.5%), which still leaves room for finer edges.
  const allowed = place(dilate(low, quick.size, quick.size, Math.round(quick.size * 0.015)), quick.size, lowRegion, W, H);
  const detailed = place(fine, assets!.best.size, region, W, H);
  for (let i = 0; i < detailed.length; i++) detailed[i] *= Math.min(1, allowed[i] * 2);
  const bestAlpha = finish(detailed, gray, W, H);
  post({ type: "result", id, stage: "best", width: W, height: H, alpha: bestAlpha }, [bestAlpha.buffer]);
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === "config") {
    assets = msg.assets;
    return;
  }
  latestJob = msg.id;
  segment(msg.id, msg.blob, msg.best).catch((err: unknown) => {
    post({ type: "error", id: msg.id, message: err instanceof Error ? err.message : String(err) });
  });
};
