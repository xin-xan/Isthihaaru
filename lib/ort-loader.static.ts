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
