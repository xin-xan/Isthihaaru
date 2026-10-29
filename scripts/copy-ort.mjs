// Copies the onnxruntime-web WebAssembly runtime into public/ so the browser loads it from our own origin.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules/onnxruntime-web/dist");
const dest = join(root, "public/ort");
mkdirSync(dest, { recursive: true });
for (const file of ["ort.wasm.min.mjs", "ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log("Copied onnxruntime-web runtime to public/ort");
