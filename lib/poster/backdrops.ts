/**
 * Built-in product scenes drawn on canvas, so the app works with no image API at all.
 * Every scene is laid out around the product's real position: pedestals and table tops
 * sit exactly under the cut-out, so the product always stands on something.
 */

export interface ProductRect {
  cx: number;
  baseY: number;
  w: number;
  h: number;
}

export interface BackdropContext {
  W: number;
  H: number;
  u: number;
  /** text on the left, product on the right */
  left: boolean;
  primary: string;
  accent: string;
  product: ProductRect;
}

export interface Backdrop {
  id: string;
  label: string;
  /** true when the scene is dark enough for light text */
  dark: boolean;
  draw: (ctx: CanvasRenderingContext2D, o: BackdropContext) => void;
}

// ---------- helpers ----------

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(h: string): [number, number, number] {
  let s = h.replace("#", "");
  if (s.length === 3) s = s.replace(/./g, (c) => c + c);
  const n = parseInt(s.slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number) {
  const x = hex(a);
  const y = hex(b);
  const c = (i: number) => Math.round(x[i] + (y[i] - x[i]) * t);
  return `rgb(${c(0)}, ${c(1)}, ${c(2)})`;
}

function vgrad(ctx: CanvasRenderingContext2D, x: number, y0: number, w: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(x, y0, w, y1 - y0);
}

/** Draws at low resolution and scales up: a cheap, portable blur (ctx.filter isn't everywhere). */
function soft(ctx: CanvasRenderingContext2D, W: number, H: number, scale: number, draw: (c: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(W * scale));
  c.height = Math.max(1, Math.round(H * scale));
  const x = c.getContext("2d")!;
  x.scale(scale, scale);
  draw(x);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(c, 0, 0, W, H);
  ctx.restore();
}

let grainTile: HTMLCanvasElement | null = null;
function grain(ctx: CanvasRenderingContext2D, W: number, H: number, alpha: number) {
  if (!grainTile) {
    grainTile = document.createElement("canvas");
    grainTile.width = grainTile.height = 160;
    const g = grainTile.getContext("2d")!;
    const img = g.createImageData(160, 160);
    const r = rng(7);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 110 + r() * 40;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "overlay";
  ctx.fillStyle = ctx.createPattern(grainTile, "repeat")!;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function vignette(ctx: CanvasRenderingContext2D, W: number, H: number, strength: number) {
  const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Soft radial glow, e.g. a spotlight behind the product. */
function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  const [cr, cg, cb] = hex(color);
  g.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
  g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

interface PedestalStyle {
  top: string;
  side: string;
  shade: string;
  rim?: string;
  /** radius relative to product width */
  size?: number;
  /** height in u */
  height?: number;
  /** "round" cylinder or "slab" stone block */
  shape?: "round" | "slab";
}

/** A podium whose top surface is exactly at the product base. Returns its bottom y. */
function pedestal(ctx: CanvasRenderingContext2D, o: BackdropContext, s: PedestalStyle): number {
  const { cx, baseY, w } = o.product;
  const { u, H } = o;
  const rx = Math.max(w * (s.size ?? 0.85), 120 * u);
  const ry = rx * (s.shape === "slab" ? 0.1 : 0.17);
  const ph = Math.min((s.height ?? 150) * u, (H - baseY) * 0.85);
  const lightDir = o.left ? -1 : 1;

  // floor shadow
  ctx.save();
  ctx.translate(cx + lightDir * -rx * 0.12, baseY + ph);
  ctx.scale(1, 0.22);
  const fs = ctx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.5);
  fs.addColorStop(0, "rgba(0,0,0,0.35)");
  fs.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = fs;
  ctx.beginPath();
  ctx.arc(0, 0, rx * 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // body
  const side = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  const lit = o.left ? 0.35 : 0.65;
  side.addColorStop(0, s.shade);
  side.addColorStop(lit, s.side);
  side.addColorStop(1, s.shade);
  ctx.fillStyle = side;
  ctx.beginPath();
  if (s.shape === "slab") {
    ctx.moveTo(cx - rx, baseY);
    ctx.lineTo(cx - rx * 1.02, baseY + ph);
    ctx.lineTo(cx + rx * 1.02, baseY + ph);
    ctx.lineTo(cx + rx, baseY);
  } else {
    ctx.moveTo(cx - rx, baseY);
    ctx.lineTo(cx - rx, baseY + ph);
    ctx.ellipse(cx, baseY + ph, rx, ry, 0, Math.PI, 0, true);
    ctx.lineTo(cx + rx, baseY);
  }
  ctx.closePath();
  ctx.fill();

  // top face
  ctx.beginPath();
  if (s.shape === "slab") {
    ctx.moveTo(cx - rx, baseY);
    ctx.lineTo(cx - rx * 0.9, baseY - ry * 2);
    ctx.lineTo(cx + rx * 0.9, baseY - ry * 2);
    ctx.lineTo(cx + rx, baseY);
    ctx.closePath();
  } else {
    ctx.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI * 2);
  }
  const tg = ctx.createLinearGradient(0, baseY - ry * 2, 0, baseY + ry);
  tg.addColorStop(0, mix(s.top, "#000000", 0.06));
  tg.addColorStop(1, s.top);
  ctx.fillStyle = tg;
  ctx.fill();
  if (s.rim) {
    ctx.strokeStyle = s.rim;
    ctx.lineWidth = 3 * u;
    ctx.stroke();
  }
  return baseY + ph;
}

function leaf(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, angle: number, color: string) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(len * 0.5, -len * 0.32, len, 0);
  ctx.quadraticCurveTo(len * 0.5, len * 0.32, 0, 0);
  ctx.fill();
  ctx.restore();
}

/** Clusters of blurred leaves in the corners, like out-of-focus foreground plants. */
function foliage(ctx: CanvasRenderingContext2D, o: BackdropContext, colors: string[], seed: number, density = 1) {
  const { W, H, u } = o;
  const r = rng(seed);
  soft(ctx, W, H, 0.12, (c) => {
    const clusters = [
      { x: o.left ? W * 1.02 : -W * 0.02, y: H * 0.32, dir: o.left ? Math.PI : 0 },
      { x: o.left ? -W * 0.04 : W * 1.04, y: H * 0.95, dir: o.left ? -0.4 : Math.PI + 0.4 },
    ];
    for (const cl of clusters) {
      const n = Math.round(9 * density);
      for (let i = 0; i < n; i++) {
        const a = cl.dir + (r() - 0.5) * 1.6;
        leaf(c, cl.x + (r() - 0.5) * 120 * u, cl.y + (r() - 0.5) * 260 * u, (180 + r() * 220) * u, a, colors[i % colors.length]);
      }
    }
  });
}

function bokeh(ctx: CanvasRenderingContext2D, o: BackdropContext, color: string, count: number, seed: number, maxR = 60) {
  const r = rng(seed);
  const [cr, cg, cb] = hex(color);
  for (let i = 0; i < count; i++) {
    const x = r() * o.W;
    const y = r() * o.H * 0.75;
    const rad = (14 + r() * maxR) * o.u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.12 + r() * 0.3;
    g.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
    g.addColorStop(0.7, `rgba(${cr},${cg},${cb},${a * 0.6})`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A soft beam of window light falling across the wall towards the product. */
function windowLight(ctx: CanvasRenderingContext2D, o: BackdropContext, alpha: number) {
  const { W, H } = o;
  soft(ctx, W, H, 0.06, (c) => {
    c.fillStyle = `rgba(255,252,240,${alpha})`;
    const x0 = o.left ? W * 0.45 : W * 0.55;
    const d = o.left ? 1 : -1;
    c.beginPath();
    c.moveTo(x0, 0);
    c.lineTo(x0 + d * W * 0.28, 0);
    c.lineTo(x0 + d * W * 0.05, H * 0.8);
    c.lineTo(x0 - d * W * 0.2, H * 0.8);
    c.closePath();
    c.fill();
  });
}

function marbleVeins(ctx: CanvasRenderingContext2D, o: BackdropContext, y0: number, color: string, seed: number) {
  const r = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, y0, o.W, o.H - y0);
  ctx.clip();
  ctx.strokeStyle = color;
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = (0.6 + r() * 1.6) * o.u;
    ctx.beginPath();
    let x = r() * o.W;
    let y = y0 + r() * (o.H - y0);
    ctx.moveTo(x, y);
    for (let j = 0; j < 6; j++) {
      x += (r() - 0.3) * 160 * o.u;
      y += (r() - 0.5) * 60 * o.u;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function horizonFor(o: BackdropContext) {
  return o.product.baseY + Math.min(150 * o.u, (o.H - o.product.baseY) * 0.85) * 0.3;
}

// ---------- scenes ----------

export const BACKDROPS: Backdrop[] = [
  {
    id: "natural",
    label: "Natural light",
    dark: false,
    draw(ctx, o) {
      const { W, H } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, hz, [
        [0, "#f4efe6"],
        [1, "#e6ddcf"],
      ]);
      windowLight(ctx, o, 0.55);
      vgrad(ctx, 0, hz, W, H, [
        [0, "#ebe6de"],
        [1, "#d9d2c6"],
      ]);
      marbleVeins(ctx, o, hz, "rgba(150,140,125,0.18)", 3);
      pedestal(ctx, o, { top: "#e9e1d3", side: "#ddd3c2", shade: "#b9ad99", shape: "slab", height: 120, size: 1 });
      foliage(ctx, o, ["#4f7d3a", "#6b9a45", "#3f6a30"], 11);
      grain(ctx, W, H, 0.08);
    },
  },
  {
    id: "studio",
    label: "Studio",
    dark: false,
    draw(ctx, o) {
      const { W, H, u } = o;
      vgrad(ctx, 0, 0, W, H, [
        [0, "#eeeeec"],
        [0.7, "#dededa"],
        [1, "#cfcfca"],
      ]);
      glow(ctx, o.product.cx, o.product.baseY - o.product.h * 0.5, 520 * u, "#ffffff", 0.85);
      pedestal(ctx, o, { top: "#f7f7f5", side: "#ececea", shade: "#bdbdb8", height: 140 });
      vignette(ctx, W, H, 0.18);
      grain(ctx, W, H, 0.06);
    },
  },
  {
    id: "brand",
    label: "Brand colours",
    dark: false,
    draw(ctx, o) {
      const { W, H, u } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, hz, [
        [0, mix(o.accent, "#ffffff", 0.86)],
        [1, mix(o.accent, "#ffffff", 0.7)],
      ]);
      // large arch behind the product
      ctx.fillStyle = mix(o.primary, "#ffffff", 0.78);
      const aw = Math.max(o.product.w * 1.25, 260 * u);
      ctx.beginPath();
      ctx.moveTo(o.product.cx - aw, hz);
      ctx.lineTo(o.product.cx - aw, o.product.baseY - o.product.h * 0.9);
      ctx.arc(o.product.cx, o.product.baseY - o.product.h * 0.9, aw, Math.PI, 0);
      ctx.lineTo(o.product.cx + aw, hz);
      ctx.fill();
      vgrad(ctx, 0, hz, W, H, [
        [0, mix(o.primary, "#ffffff", 0.82)],
        [1, mix(o.primary, "#ffffff", 0.7)],
      ]);
      pedestal(ctx, o, { top: mix(o.primary, "#ffffff", 0.35), side: o.primary, shade: mix(o.primary, "#000000", 0.35), height: 150 });
      grain(ctx, W, H, 0.05);
    },
  },
  {
    id: "pastel",
    label: "Pastel",
    dark: false,
    draw(ctx, o) {
      const { W, H, u } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, hz, [
        [0, "#f9e4e1"],
        [1, "#f3d3cf"],
      ]);
      ctx.fillStyle = "#f6c9c1";
      const r = Math.max(o.product.w * 1.1, 230 * u);
      ctx.beginPath();
      ctx.arc(o.product.cx + (o.left ? 1 : -1) * r * 0.35, o.product.baseY - o.product.h * 0.75, r, 0, Math.PI * 2);
      ctx.fill();
      vgrad(ctx, 0, hz, W, H, [
        [0, "#f2d6d0"],
        [1, "#e9c4bd"],
      ]);
      // small secondary podium beside the main one
      const side = o.left ? -1 : 1;
      const small: BackdropContext = {
        ...o,
        product: { ...o.product, cx: o.product.cx + side * Math.max(o.product.w, 200 * u) * 1.05, baseY: o.product.baseY + 70 * u, w: o.product.w * 0.6 },
      };
      pedestal(ctx, small, { top: "#fbe7d9", side: "#f5d5c0", shade: "#d9ab92", height: 90 });
      pedestal(ctx, o, { top: "#fff3ec", side: "#fbe2d6", shade: "#dcae9f", height: 150 });
      grain(ctx, W, H, 0.05);
    },
  },
  {
    id: "luxury",
    label: "Luxury",
    dark: true,
    draw(ctx, o) {
      const { W, H, u } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, H, [
        [0, "#16140f"],
        [0.6, "#1f1b14"],
        [1, "#0c0b08"],
      ]);
      glow(ctx, o.product.cx, o.product.baseY - o.product.h * 0.55, 560 * u, "#c9a24a", 0.32);
      ctx.strokeStyle = "rgba(214,178,94,0.55)";
      ctx.lineWidth = 3 * u;
      ctx.beginPath();
      ctx.arc(o.product.cx, o.product.baseY - o.product.h * 0.55, Math.max(o.product.h * 0.62, 240 * u), 0, Math.PI * 2);
      ctx.stroke();
      vgrad(ctx, 0, hz, W, H, [
        [0, "rgba(40,35,26,0.9)"],
        [1, "rgba(8,7,5,1)"],
      ]);
      marbleVeins(ctx, o, hz, "rgba(214,178,94,0.16)", 9);
      pedestal(ctx, o, { top: "#2b2720", side: "#1d1a15", shade: "#060504", rim: "rgba(214,178,94,0.85)", height: 150 });
      vignette(ctx, W, H, 0.45);
      grain(ctx, W, H, 0.07);
    },
  },
  {
    id: "beach",
    label: "Beach",
    dark: false,
    draw(ctx, o) {
      const { W, H, u } = o;
      const sea = o.product.baseY - o.product.h * 0.25;
      const sand = horizonFor(o) - 30 * u;
      vgrad(ctx, 0, 0, W, sea, [
        [0, "#8fd0ea"],
        [1, "#d8f1f6"],
      ]);
      glow(ctx, o.left ? W * 0.8 : W * 0.2, H * 0.12, 420 * u, "#fff8dc", 0.9);
      vgrad(ctx, 0, sea, W, sand, [
        [0, "#2fb7c9"],
        [0.6, "#5fd3d6"],
        [1, "#a9e7df"],
      ]);
      // glints on the lagoon
      const r = rng(21);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      for (let i = 0; i < 40; i++) ctx.fillRect(r() * W, sea + r() * (sand - sea), (10 + r() * 40) * u, 2 * u);
      vgrad(ctx, 0, sand, W, H, [
        [0, "#f3e6cb"],
        [1, "#e3cfa6"],
      ]);
      soft(ctx, W, H, 0.1, (c) => {
        c.fillStyle = "rgba(255,255,255,0.6)";
        c.beginPath();
        c.ellipse(W / 2, sand, W * 0.7, 18 * u, 0, 0, Math.PI * 2);
        c.fill();
      });
      pedestal(ctx, o, { top: "#fbf6ec", side: "#f1e7d4", shade: "#c9b48d", height: 130 });
      foliage(ctx, o, ["#2f6b34", "#3f8a3f", "#285a2b"], 5, 0.8);
      grain(ctx, W, H, 0.05);
    },
  },
  {
    id: "chilled",
    label: "Ice cold",
    dark: false,
    draw(ctx, o) {
      const { W, H, u } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, hz, [
        [0, "#e6f4fb"],
        [1, "#bfe1f2"],
      ]);
      bokeh(ctx, o, "#ffffff", 26, 4, 70);
      vgrad(ctx, 0, hz, W, H, [
        [0, "#cde8f5"],
        [1, "#a7d1e8"],
      ]);
      pedestal(ctx, o, { top: "#f4fbff", side: "#dceff9", shade: "#8fbcd6", height: 140 });
      // ice cubes around the base
      const r = rng(17);
      const { cx, baseY, w } = o.product;
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? 1 : -1;
        const s = (40 + r() * 46) * u;
        const x = cx + side * (w * 0.55 + r() * 110 * u);
        const y = baseY - s * 0.55 + r() * 18 * u;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((r() - 0.5) * 0.9);
        const g = ctx.createLinearGradient(-s, -s, s, s);
        g.addColorStop(0, "rgba(255,255,255,0.85)");
        g.addColorStop(0.5, "rgba(190,225,245,0.45)");
        g.addColorStop(1, "rgba(255,255,255,0.75)");
        ctx.fillStyle = g;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.22);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      grain(ctx, W, H, 0.05);
    },
  },
  {
    id: "wood",
    label: "Wooden table",
    dark: false,
    draw(ctx, o) {
      const { W, H, u } = o;
      const hz = o.product.baseY - 6 * u;
      vgrad(ctx, 0, 0, W, hz, [
        [0, "#f3ebe0"],
        [1, "#e2d3bf"],
      ]);
      windowLight(ctx, o, 0.45);
      vgrad(ctx, 0, hz, W, H, [
        [0, "#b98a5e"],
        [1, "#8a5f3b"],
      ]);
      const r = rng(31);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, hz, W, H - hz);
      ctx.clip();
      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = `rgba(70,40,20,${0.05 + r() * 0.12})`;
        ctx.lineWidth = (1 + r() * 3) * u;
        const y = hz + r() * (H - hz);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(W * 0.3, y + (r() - 0.5) * 20 * u, W * 0.7, y + (r() - 0.5) * 20 * u, W, y);
        ctx.stroke();
      }
      ctx.restore();
      vgrad(ctx, 0, hz, W, hz + 10 * u, [
        [0, "rgba(255,240,220,0.55)"],
        [1, "rgba(255,240,220,0)"],
      ]);
      foliage(ctx, o, ["#557a35", "#6f9442"], 8, 0.6);
      grain(ctx, W, H, 0.07);
    },
  },
  {
    id: "leafy",
    label: "Tropical green",
    dark: true,
    draw(ctx, o) {
      const { W, H } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, hz, [
        [0, "#1d3b2a"],
        [1, "#2c5a3d"],
      ]);
      foliage(ctx, o, ["#3e7a4b", "#4f9159", "#2a5c39", "#5fa766"], 13, 1.6);
      glow(ctx, o.product.cx, o.product.baseY - o.product.h * 0.5, 480, "#e8f5c8", 0.28);
      vgrad(ctx, 0, hz, W, H, [
        [0, "#20402c"],
        [1, "#13291c"],
      ]);
      pedestal(ctx, o, { top: "#d9d4c7", side: "#bdb7a6", shade: "#6f6a5c", shape: "slab", height: 120, size: 1 });
      vignette(ctx, W, H, 0.35);
      grain(ctx, W, H, 0.06);
    },
  },
  {
    id: "sunset",
    label: "Sunset",
    dark: true,
    draw(ctx, o) {
      const { W, H, u } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, hz, [
        [0, "#3b1f4a"],
        [0.55, "#c4506a"],
        [1, "#f29a62"],
      ]);
      ctx.fillStyle = "rgba(255,214,150,0.9)";
      ctx.beginPath();
      ctx.arc(o.product.cx, hz - 10 * u, Math.max(o.product.w * 0.95, 200 * u), Math.PI, 0);
      ctx.fill();
      glow(ctx, o.product.cx, hz, 600 * u, "#ffcf8a", 0.45);
      vgrad(ctx, 0, hz, W, H, [
        [0, "#7a3448"],
        [1, "#2e1626"],
      ]);
      pedestal(ctx, o, { top: "#f6d2b8", side: "#d99a86", shade: "#5c2c3a", height: 150 });
      grain(ctx, W, H, 0.06);
    },
  },
  {
    id: "festive",
    label: "Ramadan / Eid",
    dark: true,
    draw(ctx, o) {
      const { W, H, u } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, H, [
        [0, "#0f2a33"],
        [0.7, "#12343c"],
        [1, "#08181d"],
      ]);
      bokeh(ctx, o, "#e9c46a", 30, 12, 55);
      // crescent moon on the text side's opposite top corner
      const mx = o.left ? W * 0.86 : W * 0.14;
      const my = H * 0.2;
      const mr = 70 * u;
      ctx.fillStyle = "#f4d58d";
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#0f2a33";
      ctx.beginPath();
      ctx.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.9, 0, Math.PI * 2);
      ctx.fill();
      // hanging lanterns
      const r = rng(19);
      for (let i = 0; i < 3; i++) {
        const lx = o.product.cx + (i - 1) * 200 * u + (r() - 0.5) * 40 * u;
        const ly = (120 + r() * 160) * u;
        ctx.strokeStyle = "rgba(233,196,106,0.6)";
        ctx.lineWidth = 2 * u;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, ly);
        ctx.stroke();
        glow(ctx, lx, ly + 45 * u, 110 * u, "#ffcc66", 0.45);
        ctx.fillStyle = "#c8963e";
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + 26 * u, ly + 22 * u);
        ctx.lineTo(lx + 22 * u, ly + 78 * u);
        ctx.lineTo(lx - 22 * u, ly + 78 * u);
        ctx.lineTo(lx - 26 * u, ly + 22 * u);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255,226,150,0.85)";
        ctx.fillRect(lx - 14 * u, ly + 30 * u, 28 * u, 40 * u);
      }
      vgrad(ctx, 0, hz, W, H, [
        [0, "rgba(10,30,36,0.9)"],
        [1, "#05100f"],
      ]);
      pedestal(ctx, o, { top: "#e3c27a", side: "#c49a48", shade: "#5a4318", rim: "rgba(255,236,180,0.8)", height: 150 });
      grain(ctx, W, H, 0.06);
    },
  },
  {
    id: "minimal",
    label: "Clean white",
    dark: false,
    draw(ctx, o) {
      const { W, H } = o;
      const hz = horizonFor(o);
      vgrad(ctx, 0, 0, W, hz, [
        [0, "#fdfdfc"],
        [1, "#f1f1ef"],
      ]);
      vgrad(ctx, 0, hz, W, H, [
        [0, "#f4f4f2"],
        [1, "#e6e6e3"],
      ]);
      pedestal(ctx, o, { top: "#ffffff", side: "#f6f6f4", shade: "#cfcfcb", height: 110, size: 0.95 });
      grain(ctx, W, H, 0.04);
    },
  },
];

export const findBackdrop = (id: string | null) => (id ? (BACKDROPS.find((b) => b.id === id) ?? null) : null);
