export type Ort = typeof import("onnxruntime-web");

/** Next.js build: load the runtime from public/ort so the bundler never touches onnxruntime's wasm loader. */
export async function loadOrt(): Promise<Ort> {
  const ort: Ort = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ "/ort/ort.wasm.min.mjs" as string);
  ort.env.wasm.wasmPaths = "/ort/";
  return ort;
}
