import * as ortWasm from "onnxruntime-web/wasm";
import type { Ort } from "./ort-loader";

/**
 * Static build (swapped in by scripts/build-static.mjs): the runtime is bundled, and the
 * WebAssembly binary is fetched from a file published next to the page.
 */
export async function loadOrt(): Promise<Ort> {
  const ort = ortWasm as unknown as Ort;
  if (!ort.env.wasm.wasmBinary) {
    const res = await fetch(new URL("ort-wasm-simd-threaded.wasm", document.baseURI));
    if (!res.ok) throw new Error(`Runtime download failed (${res.status})`);
    ort.env.wasm.wasmBinary = await res.arrayBuffer();
  }
  return ort;
}

/** The static host only serves web file types, so the model ships base64-encoded as text. */
export async function loadModel(): Promise<Uint8Array> {
  const res = await fetch(new URL("models/u2netp.txt", document.baseURI));
  if (!res.ok) throw new Error(`Model download failed (${res.status})`);
  const bin = atob((await res.text()).trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
