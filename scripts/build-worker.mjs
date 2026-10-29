// Bundles the background-removal worker (lib/segment/worker.ts) with onnxruntime into one ES module.
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function buildWorker(outfile) {
  await esbuild.build({
    entryPoints: [join(root, "lib/segment/worker.ts")],
    bundle: true,
    format: "esm",
    target: "es2020",
    minify: true,
    outfile,
    logLevel: "warning",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildWorker(resolve(root, process.argv[2] ?? "public/bg-worker.js"));
  console.log("Built background-removal worker");
}
