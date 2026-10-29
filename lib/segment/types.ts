export interface ModelAsset {
  /** URL relative to SegmentAssets.base. For "base64", a .txt file or a .json manifest of parts. */
  url: string;
  encoding: "binary" | "base64";
  /** square input size the model expects */
  size: number;
  /** input normalisation: ImageNet mean/std (U²-Net) or x - 0.5 (ISNet) */
  norm: "imagenet" | "half";
}

export interface SegmentAssets {
  /** absolute base URL the other URLs resolve against (filled in at runtime) */
  base: string;
  worker: string;
  wasm: string;
  quick: ModelAsset;
  best: ModelAsset;
}

export type WorkerRequest = { type: "config"; assets: SegmentAssets } | { type: "segment"; id: number; blob: Blob; best: boolean };

export type WorkerResponse =
  | { type: "result"; id: number; stage: "quick" | "best"; width: number; height: number; alpha: Uint8ClampedArray }
  | { type: "status"; id: number; stage: "best" }
  | { type: "error"; id: number; message: string };
