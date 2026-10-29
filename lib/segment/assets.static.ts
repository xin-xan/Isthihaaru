import type { SegmentAssets } from "./types";

/**
 * Static build (swapped in by scripts/build-static.mjs): paths are relative to the page, and
 * models ship as base64 text because static hosts like claude.ai artifacts only serve web file types.
 */
export const SEGMENT_ASSETS: Omit<SegmentAssets, "base"> = {
  worker: "bg-worker.js",
  wasm: "ort-wasm-simd-threaded.wasm",
  quick: { url: "models/u2netp.txt", encoding: "base64", size: 320, norm: "imagenet" },
  best: { url: "models/isnet-int8.json", encoding: "base64", size: 1024, norm: "half" },
};
