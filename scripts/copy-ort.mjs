// Copies the onnxruntime-web WebAssembly binary into public/ so the cut-out worker loads it from our own origin.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "public/ort"), { recursive: true });
copyFileSync(join(root, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"), join(root, "public/ort/ort-wasm-simd-threaded.wasm"));
console.log("Copied onnxruntime-web runtime to public/ort");
