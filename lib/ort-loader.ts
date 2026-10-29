export type Ort = typeof import("onnxruntime-web");

/** Next.js build: load the runtime from public/ort so the bundler never touches onnxruntime's wasm loader. */
export async function loadOrt(): Promise<Ort> {
  const ort: Ort = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/ort/ort.wasm.min.mjs" as string);
  ort.env.wasm.wasmPaths = "/ort/";
  return ort;
}

export async function loadModel(): Promise<Uint8Array> {
  const res = await fetch(new URL("models/u2netp.onnx", document.baseURI));
  if (!res.ok) throw new Error(`Model download failed (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}
