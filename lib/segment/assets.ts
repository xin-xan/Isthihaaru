import type { SegmentAssets } from "./types";

/** Next.js build: files served from public/ (worker built by scripts/build-worker.mjs). */
export const SEGMENT_ASSETS: Omit<SegmentAssets, "base"> = {
  worker: "/bg-worker.js",
  wasm: "/ort/ort-wasm-simd-threaded.wasm",
  quick: { url: "/models/u2netp.onnx", encoding: "binary", size: 320, norm: "imagenet" },
  best: { url: "/models/isnet-int8.onnx", encoding: "binary", size: 1024, norm: "half" },
};
