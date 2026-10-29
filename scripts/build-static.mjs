// Builds a no-server version of the app into dist/: one HTML page (inline CSS + JS, React from cdnjs)
// plus the cut-out model, the onnxruntime WebAssembly binary and the example product image.
// Only the built-in scene engine works here; the AI engines need the Next.js server.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "dist");
const REACT = "18.3.1";

rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "models"), { recursive: true });
mkdirSync(join(out, "examples"), { recursive: true });

// React comes from cdnjs as UMD globals; these shims point imports at them.
const globals = {
  name: "react-globals",
  setup(build) {
    build.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (args) => ({ path: args.path, namespace: "react-global" }));
    build.onLoad({ filter: /.*/, namespace: "react-global" }, (args) => {
      if (args.path === "react/jsx-runtime" || args.path === "react/jsx-dev-runtime") {
        return {
          contents: `const R = window.React;
const jsx = (type, props, key) => R.createElement(type, key === undefined ? props : { ...props, key });
export { jsx, jsx as jsxs, jsx as jsxDEV };
export const Fragment = R.Fragment;`,
          loader: "js",
        };
      }
      const g = args.path.startsWith("react-dom") ? "ReactDOM" : "React";
      return { contents: `module.exports = window.${g};`, loader: "js" };
    });
    // Use the bundled onnxruntime build instead of loading it from /ort at runtime.
    build.onResolve({ filter: /\/ort-loader$/ }, (args) =>
      args.importer.includes("ort-loader") ? undefined : { path: join(root, "lib/ort-loader.static.ts") },
    );
  },
};

const result = await esbuild.build({
  entryPoints: [join(root, "static/main.tsx")],
  bundle: true,
  write: false,
  format: "esm",
  target: "es2020",
  minify: true,
  jsx: "automatic",
  alias: { "@": root },
  define: {
    "process.env.NEXT_PUBLIC_STATIC_BUILD": '"1"',
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "warning",
  plugins: [globals],
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

execFileSync(join(root, "node_modules/.bin/tailwindcss"), ["-i", join(root, "app/globals.css"), "-o", join(out, "app.css"), "--minify"], {
  cwd: root,
  stdio: "inherit",
});
const css = readFileSync(join(out, "app.css"), "utf8");
rmSync(join(out, "app.css"));

const fonts =
  "https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,600;1,700&family=Noto+Sans+Thaana:wght@400;500;600;700&family=Kaushan+Script&display=swap";
const page = `<title>Isthihaaru</title>
<meta name="description" content="Turn a phone photo of your product into a professional advertisement post in seconds.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/${REACT}/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/${REACT}/umd/react-dom.production.min.js"></script>
<script type="module">${js}</script>
`;
writeFileSync(join(out, "index.html"), page);
// Local preview needs a full document; the artifact host adds this skeleton itself.
writeFileSync(join(out, "preview.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>${page}</body></html>`);

copyFileSync(join(root, "public/models/u2netp.onnx"), join(out, "models/u2netp.onnx"));
copyFileSync(join(root, "node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm"), join(out, "ort-wasm-simd-threaded.wasm"));
copyFileSync(join(root, "public/examples/sample-product.webp"), join(out, "examples/sample-product.webp"));
console.log(`Static build written to dist/ (page ${(page.length / 1024).toFixed(0)} KB)`);
