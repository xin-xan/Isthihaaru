/**
 * Mask clean-up for product cut-outs. Pure functions on Float32 masks in 0..1 (row-major, w*h),
 * safe to run in a worker.
 */

/** Rescales a raw model output to 0..1. */
export function normalize(m: Float32Array): Float32Array {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of m) {
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const out = new Float32Array(m.length);
  const span = hi - lo || 1;
  for (let i = 0; i < m.length; i++) out[i] = (m[i] - lo) / span;
  return out;
}

/** 4-connected component labels of `on` pixels; returns labels (0 = off) and each label's area. */
function components(on: Uint8Array, w: number, h: number) {
  const labels = new Int32Array(w * h);
  const areas: number[] = [0];
  const stack = new Int32Array(w * h);
  let next = 1;
  for (let start = 0; start < on.length; start++) {
    if (!on[start] || labels[start]) continue;
    let top = 0;
    stack[top++] = start;
    labels[start] = next;
    let area = 0;
    while (top) {
      const i = stack[--top];
      area++;
      const x = i % w;
      const y = (i - x) / w;
      if (x > 0 && on[i - 1] && !labels[i - 1]) (labels[i - 1] = next), (stack[top++] = i - 1);
      if (x < w - 1 && on[i + 1] && !labels[i + 1]) (labels[i + 1] = next), (stack[top++] = i + 1);
      if (y > 0 && on[i - w] && !labels[i - w]) (labels[i - w] = next), (stack[top++] = i - w);
      if (y < h - 1 && on[i + w] && !labels[i + w]) (labels[i + w] = next), (stack[top++] = i + w);
    }
    areas.push(area);
    next++;
  }
  return { labels, areas };
}

/**
 * Keeps the product: drops detached background blobs (much smaller than the largest piece),
 * fades soft pixels that aren't near what's kept, and fills small holes inside the product.
 */
export function cleanMask(mask: Float32Array, w: number, h: number): Float32Array {
  const m = Float32Array.from(mask);
  const n = w * h;
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) on[i] = m[i] > 0.5 ? 1 : 0;
  const { labels, areas } = components(on, w, h);
  const largest = Math.max(0, ...areas.slice(1));
  if (!largest) return m;

  // 1. drop small detached pieces
  const keepLabel = areas.map((a, i) => i > 0 && a >= largest * 0.12);
  let objectArea = 0;
  for (let i = 0; i < n; i++) {
    if (on[i] && !keepLabel[labels[i]]) {
      on[i] = 0;
      m[i] = 0;
    }
    if (on[i]) objectArea++;
  }

  // 2. soft (< 0.5) pixels survive only within a short distance of the kept object
  const reach = Math.max(2, Math.round(Math.max(w, h) * 0.015));
  const dist = new Int16Array(n).fill(-1);
  let queue = new Int32Array(n);
  let qh = 0;
  let qt = 0;
  for (let i = 0; i < n; i++) if (on[i]) (dist[i] = 0), (queue[qt++] = i);
  while (qh < qt) {
    const i = queue[qh++];
    const d = dist[i];
    if (d >= reach) continue;
    const x = i % w;
    const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w];
    for (const j of nb) {
      if (j < 0 || j >= n || dist[j] !== -1) continue;
      dist[j] = d + 1;
      queue[qt++] = j;
    }
  }
  for (let i = 0; i < n; i++) if (dist[i] === -1) m[i] = 0;

  // 3. fill small enclosed holes (glare or a pale label read as background)
  const outside = new Uint8Array(n);
  queue = new Int32Array(n);
  qh = qt = 0;
  const seed = (i: number) => {
    if (!on[i] && !outside[i]) (outside[i] = 1), (queue[qt++] = i);
  };
  for (let x = 0; x < w; x++) seed(x), seed((h - 1) * w + x);
  for (let y = 0; y < h; y++) seed(y * w), seed(y * w + w - 1);
  while (qh < qt) {
    const i = queue[qh++];
    const x = i % w;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (i - w >= 0) seed(i - w);
    if (i + w < n) seed(i + w);
  }
  const holes = new Uint8Array(n);
  for (let i = 0; i < n; i++) holes[i] = !on[i] && !outside[i] ? 1 : 0;
  const hc = components(holes, w, h);
  for (let i = 0; i < n; i++) {
    const l = hc.labels[i];
    if (l && hc.areas[l] < objectArea * 0.015) m[i] = 1;
  }
  return m;
}

/** Bounding box of mask > 0.5 as fractions of the frame, or null when empty. */
export function maskBounds(m: Float32Array, w: number, h: number) {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (m[y * w + x] > 0.5) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  return { x0: x0 / w, y0: y0 / h, x1: (x1 + 1) / w, y1: (y1 + 1) / h };
}

/** Mean over a (2r+1)^2 window, clipped at the borders. Separable running sums, O(n). */
function boxMean(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let sum = 0;
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += src[row + x];
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(w - 1, x + r);
      tmp[row + x] = sum / (hi - lo + 1);
      if (x + r + 1 < w) sum += src[row + x + r + 1];
      if (x - r >= 0) sum -= src[row + x - r];
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += tmp[y * w + x];
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(h - 1, y + r);
      out[y * w + x] = sum / (hi - lo + 1);
      if (y + r + 1 < h) sum += tmp[(y + r + 1) * w + x];
      if (y - r >= 0) sum -= tmp[(y - r) * w + x];
    }
  }
  return out;
}

/**
 * Guided filter (He et al.): snaps an upscaled, blurry mask to the real edges in the photo.
 * `gray` is the photo's luminance in 0..1 at the same size as `p`.
 */
export function guidedFilter(gray: Float32Array, p: Float32Array, w: number, h: number, r: number, eps: number): Float32Array {
  const n = w * h;
  const ip = new Float32Array(n);
  const ii = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    ip[i] = gray[i] * p[i];
    ii[i] = gray[i] * gray[i];
  }
  const mI = boxMean(gray, w, h, r);
  const mP = boxMean(p, w, h, r);
  const mIP = boxMean(ip, w, h, r);
  const mII = boxMean(ii, w, h, r);
  const a = new Float32Array(n);
  const b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const cov = mIP[i] - mI[i] * mP[i];
    const v = mII[i] - mI[i] * mI[i];
    a[i] = cov / (v + eps);
    b[i] = mP[i] - a[i] * mI[i];
  }
  const mA = boxMean(a, w, h, r);
  const mB = boxMean(b, w, h, r);
  const q = new Float32Array(n);
  for (let i = 0; i < n; i++) q[i] = Math.min(1, Math.max(0, mA[i] * gray[i] + mB[i]));
  return q;
}

/** Grows a mask by `r` pixels (max filter, separable). */
export function dilate(m: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = 0;
      for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = Math.max(v, m[y * w + k]);
      tmp[y * w + x] = v;
    }
  }
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let v = 0;
      for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = Math.max(v, tmp[k * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}
