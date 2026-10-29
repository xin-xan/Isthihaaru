/**
 * Background removal for photos on a plain background (white table, wall, sheet of paper),
 * with no model at all: the border colour is taken as the background and flood-filled inwards.
 * Instant and works on any device; returns null when the background isn't plain enough.
 */
import { cleanMask, guidedFilter } from "./postprocess";

function toLab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047);
  const y = f(0.2126 * R + 0.7152 * G + 0.0722 * B);
  const z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}

const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * @param rgba photo pixels at full size (W x H)
 * @returns alpha 0..255 at full size, or null if the background isn't plain
 */
export function plainBackgroundAlpha(rgba: Uint8ClampedArray, W: number, H: number): Uint8ClampedArray | null {
  // Work on a small copy for the flood fill, then refine edges at full size.
  const scale = Math.min(1, 400 / Math.max(W, H));
  const w = Math.max(8, Math.round(W * scale));
  const h = Math.max(8, Math.round(H * scale));
  const lab = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.min(W - 1, Math.floor((x + 0.5) / scale));
      const sy = Math.min(H - 1, Math.floor((y + 0.5) / scale));
      const k = (sy * W + sx) * 4;
      const [L, A, B] = toLab(rgba[k], rgba[k + 1], rgba[k + 2]);
      const i = (y * w + x) * 3;
      lab[i] = L;
      lab[i + 1] = A;
      lab[i + 2] = B;
    }
  }

  // Background colour = median of the border; it's "plain" when most of the border is close to it.
  const border: number[] = [];
  for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1);
  const bg = [0, 1, 2].map((c) => median(border.map((i) => lab[i * 3 + c])));
  const dist = (i: number) => Math.hypot(lab[i * 3] - bg[0], lab[i * 3 + 1] - bg[1], lab[i * 3 + 2] - bg[2]);
  const borderDist = border.map(dist);
  const close = borderDist.filter((d) => d < 12).length / border.length;
  if (close < 0.75) return null;
  const spread = median(borderDist);
  const tol = Math.min(22, Math.max(9, spread * 3 + 6));

  // Flood fill from the border through background-coloured pixels.
  const n = w * h;
  const isBg = new Uint8Array(n);
  const queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  border.forEach((i, k) => {
    if (!isBg[i] && borderDist[k] < tol) {
      isBg[i] = 1;
      queue[qt++] = i;
    }
  });
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const j of nb) {
      if (j < 0 || j >= n || isBg[j]) continue;
      if (dist(j) < tol) {
        isBg[j] = 1;
        queue[qt++] = j;
      }
    }
  }
  const mask = new Float32Array(n);
  let fg = 0;
  for (let i = 0; i < n; i++) {
    mask[i] = isBg[i] ? 0 : 1;
    fg += mask[i];
  }
  // Nothing found, or the "product" is basically the whole frame: not a plain-background photo.
  if (fg < n * 0.01 || fg > n * 0.92) return null;
  const cleaned = cleanMask(mask, w, h);

  // Upscale (nearest + box blur via guided filter) and snap to the photo's edges.
  const full = new Float32Array(W * H);
  const gray = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const my = Math.min(h - 1, Math.floor(y * scale));
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      full[i] = cleaned[my * w + Math.min(w - 1, Math.floor(x * scale))];
      gray[i] = (0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2]) / 255;
    }
  }
  const r = Math.max(2, Math.round(Math.max(W, H) / 200));
  const q = guidedFilter(gray, full, W, H, r, 2e-4);
  const alpha = new Uint8ClampedArray(W * H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = Math.round(255 * Math.min(1, Math.max(0, (q[i] - 0.15) / 0.7)));
  return alpha;
}
