import type { AdCopy, BusinessProfile, FormatId, Lang, PriceInfo, TextSide } from "../types";
import { findBackdrop, type ProductRect } from "./backdrops";
import { CONTACT_ICONS, FEATURE_ICONS, drawIcon } from "./icons";

/**
 * Canvas poster renderer. Layout follows the reference ad: brand header on the text side,
 * a short spaced tagline on the product side, a stacked headline column with feature rows,
 * a phone pill at the bottom of the text side and a brand-coloured swoosh in the product-side corner.
 * Everything is sized in units of `u` (1/1080 of the short edge) so all formats share one layout.
 */

export const LATIN = '"Montserrat", "Segoe UI", system-ui, sans-serif';
export const SCRIPT = '"Kaushan Script", "Brush Script MT", cursive';
export const DEFAULT_THAANA = '"Noto Sans Thaana", "Montserrat", sans-serif';

export interface PosterInput {
  width: number;
  height: number;
  format: FormatId;
  scene: HTMLImageElement | null;
  /** Original product photo, shown as a placeholder until a scene exists */
  productPhoto: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  /** Background-removed product, composited onto the scene in free (hybrid) mode */
  cutout: HTMLImageElement | null;
  /** true when `scene` is an empty background plate that the cut-out should be placed on */
  hybrid: boolean;
  /** id of a built-in scene from backdrops.ts; drawn instead of `scene` */
  backdrop: string | null;
  placement: ProductPlacement;
  profile: BusinessProfile;
  copy: AdCopy;
  lang: Lang;
  textSide: TextSide;
  /** "dark" = dark text for light scenes, "light" = light text for dark scenes */
  theme: "dark" | "light";
  scrim: boolean;
  price: PriceInfo;
  thaanaFamily: string;
}

export interface ProductPlacement {
  /** size multiplier, 1 = default */
  scale: number;
  /** raises the product by this fraction of the poster height */
  lift: number;
}

const THAANA_RE = /[ހ-޿]/;
export const isThaana = (s: string) => THAANA_RE.test(s);

// ---------- colour helpers ----------

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`;
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ---------- text helpers ----------

interface Ctx {
  ctx: CanvasRenderingContext2D;
  thaana: string;
}

function family(c: Ctx, s: string, latin = LATIN) {
  return isThaana(s) ? c.thaana : latin;
}

function font(c: Ctx, s: string, weight: number, size: number, opts: { italic?: boolean; latin?: string } = {}) {
  // Thaana fonts rarely ship italics; only slant Latin text.
  const italic = opts.italic && !isThaana(s) ? "italic " : "";
  c.ctx.font = `${italic}${weight} ${size}px ${family(c, s, opts.latin)}`;
}

/** Thaana needs taller lines for its vowel marks (fili). */
const lineFactor = (s: string, latin: number) => (isThaana(s) ? Math.max(latin, 1.45) : latin);

function fillText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, align: CanvasTextAlign) {
  ctx.direction = isThaana(s) ? "rtl" : "ltr";
  ctx.textAlign = align;
  ctx.fillText(s, x, y);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, spacing = 0): string[] {
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (line && measure(ctx, test, spacing) > maxW) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
  }
  return lines;
}

function measure(ctx: CanvasRenderingContext2D, s: string, spacing = 0) {
  if (!spacing) return ctx.measureText(s).width;
  let w = 0;
  for (const ch of s) w += ctx.measureText(ch).width;
  return w + spacing * Math.max(0, [...s].length - 1);
}

/** Letter-spaced text (Latin only; Thaana letters must stay joined to their fili). */
function fillSpaced(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, spacing: number, align: "left" | "right") {
  if (!spacing || isThaana(s)) return fillText(ctx, s, x, y, align);
  const total = measure(ctx, s, spacing);
  let cx = align === "left" ? x : x - total;
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  for (const ch of s) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

/** Shrinks the font until the text wraps into maxLines within maxW. */
function fit(
  c: Ctx,
  text: string,
  weight: number,
  start: number,
  min: number,
  maxW: number,
  maxLines: number,
  opts: { italic?: boolean; latin?: string } = {},
) {
  let size = start;
  for (;;) {
    font(c, text, weight, size, opts);
    const lines = wrap(c.ctx, text, maxW);
    const tooWide = lines.some((l) => c.ctx.measureText(l).width > maxW);
    if ((lines.length <= maxLines && !tooWide) || size <= min) return { size, lines };
    size = Math.max(min, size * 0.94);
  }
}

// ---------- main renderer ----------

export function renderPoster(canvas: HTMLCanvasElement, p: PosterInput) {
  const W = p.width;
  const H = p.height;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const c: Ctx = { ctx, thaana: p.thaanaFamily || DEFAULT_THAANA };
  const u = Math.min(W, H) / 1080;
  const pad = (p.format === "landscape" ? 80 : 66) * u;
  const left = p.textSide === "left";
  const rtl = p.lang === "dv";
  const story = p.format === "story";

  const primary = p.profile.primaryColor || "#1B6B2F";
  const accent = p.profile.accentColor || "#7CB342";
  const dark = p.theme === "dark";
  const pal = {
    name: dark ? mix(primary, "#000000", 0.12) : "#ffffff",
    subtitle: dark ? accent : mix(accent, "#ffffff", 0.35),
    category: dark ? primary : mix(accent, "#ffffff", 0.3),
    body: dark ? "#2a2a2a" : "rgba(255,255,255,0.94)",
    circle: dark ? rgba(accent, 0.22) : "rgba(255,255,255,0.18)",
    icon: dark ? primary : "#ffffff",
  };

  // ---- background ----
  drawBackground(ctx, p, W, H, left, u);

  if (p.scrim) drawScrim(ctx, W, H, left, story, dark);
  if (p.cutout && (p.hybrid || !p.scene)) drawProduct(ctx, p, W, H, left, u);

  if (!dark) {
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 12 * u;
  }

  // ---- header (logo + business name) on the text side ----
  const headerBottom = drawHeader(c, p, { W, pad, u, left, rtl, pal, primary, accent, story });

  // ---- top tagline on the product side ----
  const topTaglineBottom = drawTopTagline(c, p, { W, pad, u, left, rtl, accent, body: pal.body });

  // ---- bottom: contacts + phone pill (text side), swoosh (product side) ----
  ctx.shadowColor = "transparent";
  drawSwoosh(c, p, { W, H, u, left, primary, accent });
  if (!dark) ctx.shadowColor = "rgba(0,0,0,0.35)";
  const bottomTop = drawContacts(c, p, { W, H, pad, u, left, rtl, primary, accent, body: pal.body, dark });

  // ---- price badge on the product side ----
  ctx.shadowColor = "transparent";
  drawPrice(c, p, { W, H, pad, u, left, primary, accent, top: topTaglineBottom });
  if (!dark) ctx.shadowColor = "rgba(0,0,0,0.35)";

  // ---- headline column ----
  const colW = W * (story ? 0.66 : p.format === "landscape" ? 0.44 : p.format === "square" ? 0.5 : 0.53);
  const colX0 = left ? pad : W - pad - colW;
  const align: "left" | "right" = rtl ? "right" : "left";
  const anchor = align === "left" ? colX0 : colX0 + colW;
  const top = headerBottom + (story ? 70 : 50) * u;
  const bottom = story ? Math.min(H * 0.6, bottomTop - 40 * u) : bottomTop - 40 * u;
  const avail = Math.max(100 * u, bottom - top);

  let k = 1;
  let h = column(c, p, k, false, anchor, 0, colW, align, u, pal, accent);
  while (h > avail && k > 0.5) {
    k *= 0.94;
    h = column(c, p, k, false, anchor, 0, colW, align, u, pal, accent);
  }
  const y0 = top + Math.max(0, avail - h) * (story ? 0.15 : 0.35);
  column(c, p, k, true, anchor, y0, colW, align, u, pal, accent);
  ctx.shadowColor = "transparent";
}

function drawBackground(ctx: CanvasRenderingContext2D, p: PosterInput, W: number, H: number, left: boolean, u: number) {
  const backdrop = findBackdrop(p.backdrop);
  if (backdrop) {
    backdrop.draw(ctx, {
      W,
      H,
      u,
      left,
      primary: p.profile.primaryColor || "#1B6B2F",
      accent: p.profile.accentColor || "#7CB342",
      product: productRect(p, W, H, left),
    });
    return;
  }
  if (p.scene) {
    drawCover(ctx, p.scene, 0, 0, W, H);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#f7f4ee");
  g.addColorStop(1, "#e9e4da");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (p.productPhoto && !p.cutout) {
    // Placeholder: original photo on the product side until the AI scene is ready.
    const boxW = p.format === "story" ? W * 0.7 : W * 0.42;
    const boxH = p.format === "story" ? H * 0.38 : H * 0.55;
    const bx = left ? W - boxW - 70 * u : 70 * u;
    const by = p.format === "story" ? H * 0.5 : (H - boxH) / 2 + 40 * u;
    const img = p.productPhoto;
    const s = Math.min(boxW / img.width, boxH / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(bx + (boxW - w) / 2, by + (boxH - h) / 2, w, h, 24 * u);
    ctx.clip();
    ctx.globalAlpha = 0.9;
    ctx.drawImage(img, bx + (boxW - w) / 2, by + (boxH - h) / 2, w, h);
    ctx.restore();
  }
}

// Where the product stands, per format, for text on the left (mirrored for the right).
const PRODUCT_SLOT: Record<FormatId, { cx: number; base: number; h: number; maxW: number }> = {
  portrait: { cx: 0.73, base: 0.8, h: 0.47, maxW: 0.4 },
  square: { cx: 0.74, base: 0.82, h: 0.53, maxW: 0.4 },
  landscape: { cx: 0.73, base: 0.84, h: 0.63, maxW: 0.38 },
  story: { cx: 0.67, base: 0.83, h: 0.36, maxW: 0.56 },
};

const avgColorCache = new WeakMap<HTMLImageElement, string>();

function averageColor(img: HTMLImageElement): string {
  const cached = avgColorCache.get(img);
  if (cached) return cached;
  const c = document.createElement("canvas");
  c.width = c.height = 8;
  const x = c.getContext("2d", { willReadFrequently: true })!;
  x.drawImage(img, 0, 0, 8, 8);
  const d = x.getImageData(0, 0, 8, 8).data;
  let r = 0;
  let g = 0;
  let b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = d.length / 4;
  const color = `rgb(${Math.round(r / n)}, ${Math.round(g / n)}, ${Math.round(b / n)})`;
  avgColorCache.set(img, color);
  return color;
}

/** Stands the cut-out product on the scene with contact + drop shadows and a light colour match. */
/** Where the product stands; built-in scenes use it to put their pedestal under the product. */
function productRect(p: PosterInput, W: number, H: number, left: boolean): ProductRect {
  const slot = PRODUCT_SLOT[p.format];
  const scale = Math.min(1.6, Math.max(0.4, p.placement.scale));
  // Before the cut-out exists, assume a typical bottle/can shape.
  const aspect = p.cutout ? p.cutout.width / p.cutout.height : 0.55;
  let h = slot.h * H * scale;
  let w = h * aspect;
  // Wide packs (biscuits, boxes) get more room than tall bottles and cans.
  const maxW = slot.maxW * W * scale * (aspect > 1.2 ? 1.35 : 1);
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  // Keep a wide product inside the frame on its side.
  // Keep a wide product inside the frame and clear of the corner swoosh.
  const wide = aspect > 1.2;
  const edge = W * (wide ? 0.94 : 0.97);
  const cx = Math.min((left ? slot.cx : 1 - slot.cx) * W, left ? edge - w / 2 : W);
  const base = slot.base - p.placement.lift - (wide ? 0.06 : 0);
  return { cx: left ? cx : Math.max(cx, W - edge + w / 2), baseY: base * H, w, h };
}

function drawProduct(ctx: CanvasRenderingContext2D, p: PosterInput, W: number, H: number, left: boolean, u: number) {
  const img = p.cutout!;
  const { cx, baseY, w, h } = productRect(p, W, H, left);
  const x = cx - w / 2;
  const y = baseY - h;

  // Product layer with ambient occlusion at the base and a hint of the scene's colour.
  const layer = document.createElement("canvas");
  layer.width = Math.max(1, Math.round(w));
  layer.height = Math.max(1, Math.round(h));
  const lx = layer.getContext("2d")!;
  lx.drawImage(img, 0, 0, layer.width, layer.height);
  lx.globalCompositeOperation = "source-atop";
  if (p.scene) {
    lx.globalAlpha = 0.1;
    lx.fillStyle = averageColor(p.scene);
    lx.fillRect(0, 0, layer.width, layer.height);
    lx.globalAlpha = 1;
  }
  const ao = lx.createLinearGradient(0, layer.height, 0, layer.height * 0.88);
  ao.addColorStop(0, "rgba(0,0,0,0.28)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  lx.fillStyle = ao;
  lx.fillRect(0, layer.height * 0.88, layer.width, layer.height * 0.12);

  // Contact shadow
  const rx = w * 0.58;
  const ry = Math.max(6 * u, w * 0.075);
  ctx.save();
  ctx.translate(cx, baseY - ry * 0.15);
  ctx.scale(1, ry / rx);
  const cs = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  cs.addColorStop(0, "rgba(0,0,0,0.5)");
  cs.addColorStop(0.55, "rgba(0,0,0,0.2)");
  cs.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = cs;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Soft drop shadow cast away from the text side (light comes from that side)
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.3)";
  ctx.shadowBlur = 46 * u;
  ctx.shadowOffsetX = (left ? 1 : -1) * 22 * u;
  ctx.shadowOffsetY = 16 * u;
  ctx.drawImage(layer, x, y, w, h);
  ctx.restore();
}

export function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function drawScrim(ctx: CanvasRenderingContext2D, W: number, H: number, left: boolean, story: boolean, dark: boolean) {
  const base = dark ? "255,252,246" : "0,0,0";
  const a = dark ? 0.72 : 0.55;
  const g = story
    ? ctx.createLinearGradient(0, 0, 0, H * 0.72)
    : left
      ? ctx.createLinearGradient(0, 0, W * 0.78, 0)
      : ctx.createLinearGradient(W, 0, W * 0.22, 0);
  g.addColorStop(0, `rgba(${base},${a})`);
  g.addColorStop(0.55, `rgba(${base},${a * 0.6})`);
  g.addColorStop(1, `rgba(${base},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  if (story) {
    const b = ctx.createLinearGradient(0, H, 0, H * 0.8);
    b.addColorStop(0, `rgba(${base},${a * 0.7})`);
    b.addColorStop(1, `rgba(${base},0)`);
    ctx.fillStyle = b;
    ctx.fillRect(0, H * 0.8, W, H * 0.2);
  }
}

interface HeaderOpts {
  W: number;
  pad: number;
  u: number;
  left: boolean;
  rtl: boolean;
  story: boolean;
  primary: string;
  accent: string;
  pal: { name: string; subtitle: string };
}

function drawHeader(c: Ctx, p: PosterInput, o: HeaderOpts): number {
  const { ctx } = c;
  const { W, pad, u, left } = o;
  const name = (o.rtl && p.profile.nameDv) || p.profile.name;
  const slogan = (o.rtl && p.profile.sloganDv) || p.profile.slogan;
  let x = left ? pad : W - pad;
  const y = pad;
  let h = 0;
  const maxBlockW = W * (o.story ? 0.62 : 0.5);

  if (p.logo) {
    const maxH = 130 * u;
    const maxW = p.profile.logoHasName ? maxBlockW : 240 * u;
    const s = Math.min(maxH / p.logo.height, maxW / p.logo.width);
    const lw = p.logo.width * s;
    const lh = p.logo.height * s;
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.drawImage(p.logo, left ? x : x - lw, y, lw, lh);
    ctx.restore();
    h = lh;
    x = left ? x + lw + 22 * u : x - lw - 22 * u;
    if (p.profile.logoHasName) return y + h;
  }

  if (!name && !slogan) return y + h;
  const avail = maxBlockW - (p.logo ? 262 * u : 0);
  const align: CanvasTextAlign = left ? "left" : "right";
  const n = name ? fit(c, name, 800, (p.logo ? 50 : 58) * u, 26 * u, avail, 1) : null;
  const sl = slogan ? fit(c, slogan, 600, 28 * u, 16 * u, avail, 1, { italic: true }) : null;
  const nh = n ? n.size * lineFactor(name, 1.1) : 0;
  const sh = sl ? sl.size * lineFactor(slogan, 1.3) : 0;
  const blockH = nh + sh;
  const by = h ? y + (h - blockH) / 2 : y;
  ctx.textBaseline = "middle";
  if (n) {
    font(c, name, 800, n.size);
    ctx.fillStyle = o.pal.name;
    fillText(ctx, n.lines[0], x, by + nh / 2, align);
  }
  if (sl) {
    font(c, slogan, 600, sl.size, { italic: true });
    ctx.fillStyle = o.pal.subtitle;
    fillText(ctx, sl.lines[0], x, by + nh + sh / 2, align);
  }
  return Math.max(y + h, by + blockH);
}

function drawTopTagline(
  c: Ctx,
  p: PosterInput,
  o: { W: number; pad: number; u: number; left: boolean; rtl: boolean; accent: string; body: string },
): number {
  const { ctx } = c;
  const raw = (o.rtl && p.profile.topTaglineDv) || p.profile.topTagline;
  const y = o.pad + 24 * o.u;
  if (!raw.trim()) return o.pad;
  const thaana = isThaana(raw);
  const text = thaana ? raw : raw.toUpperCase();
  const size = (thaana ? 26 : 21) * o.u;
  const spacing = thaana ? 0 : size * 0.28;
  const x = o.left ? o.W - o.pad : o.pad;
  const align = o.left ? "right" : "left";
  font(c, text, 500, size);
  const lines = wrap(ctx, text, o.W * 0.34, spacing).slice(0, 3);
  const lh = size * lineFactor(text, 1.6);
  ctx.textBaseline = "middle";
  ctx.fillStyle = o.body;
  lines.forEach((l, i) => fillSpaced(ctx, l, x, y + lh * i + lh / 2, spacing, align));
  const barY = y + lh * lines.length + 14 * o.u;
  ctx.fillStyle = o.accent;
  const bw = 92 * o.u;
  ctx.fillRect(o.left ? x - bw : x, barY, bw, 5 * o.u);
  return barY + 5 * o.u;
}

function drawSwoosh(
  c: Ctx,
  p: PosterInput,
  o: { W: number; H: number; u: number; left: boolean; primary: string; accent: string },
) {
  const { ctx } = c;
  const { W, H, u } = o;
  const sw = Math.min(W * 0.56, 660 * u);
  const sh = 330 * u;
  // Shapes are drawn for the bottom-right corner and mirrored when the product sits on the left.
  ctx.save();
  if (!o.left) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  const curve = (w: number, hgt: number) => {
    const path = new Path2D();
    path.moveTo(W - w, H);
    path.bezierCurveTo(W - w * 0.55, H - hgt * 0.12, W - w * 0.38, H - hgt * 0.78, W, H - hgt);
    path.lineTo(W, H);
    path.closePath();
    return path;
  };
  ctx.fillStyle = rgba(o.accent, 0.92);
  ctx.fill(curve(sw * 1.1, sh * 1.12));
  const g = ctx.createLinearGradient(W - sw, H, W, H - sh);
  g.addColorStop(0, mix(o.primary, "#000000", 0.1));
  g.addColorStop(1, o.primary);
  ctx.fillStyle = g;
  ctx.fill(curve(sw, sh));
  ctx.restore();

  const raw = (p.lang === "dv" && p.profile.footerTaglineDv) || p.profile.footerTagline;
  if (!raw.trim()) return;
  const cx = o.left ? W - sw * 0.36 : sw * 0.36;
  const cy = H - sh * 0.36;
  const thaana = isThaana(raw);
  const angle = ((o.left ? -1 : 1) * 11 * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const t = fit(c, raw, thaana ? 700 : 400, (thaana ? 36 : 42) * u, 20 * u, sw * 0.52, 2, { latin: SCRIPT });
  font(c, raw, thaana ? 700 : 400, t.size, { latin: SCRIPT });
  const lh = t.size * lineFactor(raw, 1.2);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  const startY = (-lh * (t.lines.length - 1)) / 2;
  t.lines.forEach((l, i) => fillText(ctx, l, 0, startY + lh * i, "center"));
  // little underline flourish
  const lw = Math.min(sw * 0.5, Math.max(...t.lines.map((l) => ctx.measureText(l).width)));
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 3 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  const uy = startY + lh * (t.lines.length - 1) + lh * 0.6;
  ctx.moveTo(-lw / 2, uy + 8 * u);
  ctx.quadraticCurveTo(0, uy - 4 * u, lw / 2, uy - 10 * u);
  ctx.stroke();
  ctx.restore();
}

function drawContacts(
  c: Ctx,
  p: PosterInput,
  o: { W: number; H: number; pad: number; u: number; left: boolean; rtl: boolean; primary: string; accent: string; body: string; dark: boolean },
): number {
  const { ctx } = c;
  const { W, H, pad, u, left } = o;
  const pr = p.profile;
  let bottom = H - pad;

  // Phone pill
  if (pr.show.phone && pr.phone.trim()) {
    const pillH = 94 * u;
    const y = H - pad - pillH;
    const d = pillH - 22 * u;
    ctx.font = `800 ${52 * u}px ${LATIN}`;
    const numW = ctx.measureText(pr.phone.trim()).width;
    const pillW = 11 * u + d + 32 * u + 3 * u + 30 * u + numW + 46 * u;
    const x = left ? pad : W - pad - pillW;
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 18 * u;
    ctx.shadowOffsetY = 6 * u;
    const g = ctx.createLinearGradient(x, y, x + pillW, y);
    g.addColorStop(0, mix(o.primary, "#000000", 0.08));
    g.addColorStop(1, o.primary);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.restore();
    const ccx = x + 11 * u + d / 2;
    const ccy = y + pillH / 2;
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = mix(o.primary, "#000000", 0.25);
    ctx.beginPath();
    ctx.arc(ccx, ccy, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(o.accent, 0.9);
    ctx.lineWidth = 3 * u;
    ctx.stroke();
    drawIcon(ctx, CONTACT_ICONS.phone, ccx, ccy, d * 0.5, "#ffffff", 2.2);
    const sepX = ccx + d / 2 + 32 * u;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(sepX, y + pillH * 0.28, 3 * u, pillH * 0.44);
    ctx.font = `800 ${52 * u}px ${LATIN}`;
    ctx.fillStyle = "#ffffff";
    ctx.textBaseline = "middle";
    fillText(ctx, pr.phone.trim(), sepX + 3 * u + 30 * u, ccy + 2 * u, "left");
    ctx.restore();
    bottom = y;
  }

  // Secondary contact rows
  const items: { icon: keyof typeof CONTACT_ICONS; text: string }[] = [];
  const add = (key: keyof typeof CONTACT_ICONS, text: string) => {
    if (pr.show[key as keyof typeof pr.show] && text.trim()) items.push({ icon: key, text: text.trim() });
  };
  add("whatsapp", pr.whatsapp);
  add("viber", pr.viber);
  add("instagram", pr.instagram && (pr.instagram.startsWith("@") ? pr.instagram : `@${pr.instagram}`));
  add("facebook", pr.facebook);
  add("tiktok", pr.tiktok && (pr.tiktok.startsWith("@") ? pr.tiktok : `@${pr.tiktok}`));
  add("website", pr.website);
  add("address", [pr.address, pr.island].filter((s) => s.trim()).join(", "));
  if (!items.length) return bottom;

  const size = 26 * u;
  const iconS = 30 * u;
  const gap = 34 * u;
  const rowH = 46 * u;
  const maxW = W * 0.56;
  ctx.textBaseline = "middle";
  const widths = items.map((it) => {
    font(c, it.text, 600, size);
    return iconS + 10 * u + ctx.measureText(it.text).width;
  });
  const rows: number[][] = [[]];
  let rw = 0;
  widths.forEach((w, i) => {
    const row = rows[rows.length - 1];
    if (row.length && rw + gap + w > maxW) {
      rows.push([i]);
      rw = w;
    } else {
      row.push(i);
      rw += (row.length > 1 ? gap : 0) + w;
    }
  });
  const blockBottom = bottom - (bottom === H - pad ? 0 : 18 * u);
  const blockTop = blockBottom - rows.length * rowH;
  const iconColor = o.dark ? o.primary : "#ffffff";
  rows.forEach((row, r) => {
    const cy = blockTop + rowH * r + rowH / 2;
    let x = left ? pad : W - pad;
    for (const i of row) {
      const it = items[i];
      const w = widths[i];
      const x0 = left ? x : x - w;
      drawIcon(ctx, CONTACT_ICONS[it.icon], x0 + iconS / 2, cy, iconS, iconColor, 2.2);
      font(c, it.text, 600, size);
      ctx.fillStyle = o.body;
      fillText(ctx, it.text, x0 + iconS + 10 * u, cy, "left");
      x = left ? x + w + gap : x - w - gap;
    }
  });
  return blockTop;
}

function drawPrice(
  c: Ctx,
  p: PosterInput,
  o: { W: number; H: number; pad: number; u: number; left: boolean; primary: string; accent: string; top: number },
) {
  const { price } = p;
  if (!price.show || !price.price.trim()) return;
  const { ctx } = c;
  const { W, u } = o;
  const r = 108 * u;
  const cx = o.left ? W - o.pad - r : o.pad + r;
  const cy = o.top + 46 * u + r;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.25)";
  ctx.shadowBlur = 24 * u;
  ctx.shadowOffsetY = 8 * u;
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, mix(o.primary, "#ffffff", 0.15));
  g.addColorStop(1, mix(o.primary, "#000000", 0.1));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(o.accent, 0.95);
  ctx.lineWidth = 5 * u;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10 * u, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "middle";
  const hasOld = !!price.oldPrice.trim();
  const amount = fit(c, price.price.trim(), 800, 64 * u, 26 * u, r * 1.45, 1);
  const cur = price.currency.trim();
  const curY = cy - (hasOld ? 50 : 36) * u;
  if (cur) {
    font(c, cur, 700, 24 * u);
    fillText(ctx, cur, cx, curY, "center");
  }
  font(c, price.price, 800, amount.size);
  fillText(ctx, amount.lines[0], cx, cy + (hasOld ? -4 : 8) * u, "center");
  if (hasOld) {
    const old = price.oldPrice.trim();
    font(c, old, 600, 26 * u);
    const oy = cy + 46 * u;
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    fillText(ctx, old, cx, oy, "center");
    const ow = ctx.measureText(old).width;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.moveTo(cx - ow / 2 - 4 * u, oy + 2 * u);
    ctx.lineTo(cx + ow / 2 + 4 * u, oy - 2 * u);
    ctx.stroke();
  }
}

/** Lays out (and optionally draws) the headline column; returns its height. */
function column(
  c: Ctx,
  p: PosterInput,
  k: number,
  draw: boolean,
  anchor: number,
  y0: number,
  colW: number,
  align: "left" | "right",
  u: number,
  pal: { name: string; subtitle: string; category: string; body: string; circle: string; icon: string },
  accent: string,
): number {
  const { ctx } = c;
  const s = u * k;
  const copy = p.copy;
  let y = y0;
  ctx.textBaseline = "middle";

  const block = (text: string, weight: number, start: number, min: number, maxLines: number, lf: number, color: string, gapAfter: number) => {
    if (!text.trim()) return;
    const t = fit(c, text.trim(), weight, start * s, min * s, colW, maxLines);
    const lh = t.size * lineFactor(text, lf);
    if (draw) {
      font(c, text, weight, t.size);
      ctx.fillStyle = color;
      t.lines.forEach((l, i) => fillText(ctx, l, anchor, y + lh * i + lh / 2, align));
    }
    y += lh * t.lines.length + gapAfter * s;
  };

  // Category, letter-spaced caps like "E N E R G Y   D R I N K"
  if (copy.category.trim()) {
    const raw = copy.category.trim();
    const thaana = isThaana(raw);
    const text = thaana ? raw : raw.toUpperCase();
    const size = (thaana ? 32 : 28) * s;
    const spacing = thaana ? 0 : size * 0.32;
    font(c, text, 600, size);
    const lh = size * lineFactor(text, 1.25);
    if (draw) {
      ctx.fillStyle = pal.category;
      fillSpaced(ctx, text, anchor, y + lh / 2, spacing, align);
    }
    y += lh + 16 * s;
  }

  block(copy.name, 800, 124, 54, 2, 1.02, pal.name, 6);
  block(copy.subtitle, 700, 68, 32, 2, 1.12, pal.subtitle, 26);
  block(copy.tagline, 400, 40, 24, 3, 1.28, pal.body, 30);

  // Divider (only once there is headline text above it)
  const hasText = !!(copy.name.trim() || copy.subtitle.trim() || copy.tagline.trim());
  if (draw && hasText) {
    ctx.fillStyle = accent;
    const bw = 100 * s;
    ctx.fillRect(align === "left" ? anchor : anchor - bw, y, bw, 6 * s);
  }
  if (hasText) y += 6 * s + 34 * s;

  // Feature rows
  const feats = copy.features.filter((f) => f.text.trim());
  const d = 90 * s;
  const textW = colW - d - 26 * s;
  feats.forEach((f, idx) => {
    const t = fit(c, f.text.trim(), 500, 32 * s, 20 * s, Math.min(textW, 330 * s), 2);
    const lh = t.size * lineFactor(f.text, 1.2);
    const rowH = Math.max(d, lh * t.lines.length);
    if (draw) {
      const ccx = align === "left" ? anchor + d / 2 : anchor - d / 2;
      const ccy = y + rowH / 2;
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = pal.circle;
      ctx.beginPath();
      ctx.arc(ccx, ccy, d / 2, 0, Math.PI * 2);
      ctx.fill();
      drawIcon(ctx, FEATURE_ICONS[f.icon] ?? FEATURE_ICONS.check, ccx, ccy, d * 0.5, pal.icon, 1.8);
      ctx.restore();
      font(c, f.text, 500, t.size);
      ctx.fillStyle = pal.body;
      const tx = align === "left" ? anchor + d + 26 * s : anchor - d - 26 * s;
      const ty = ccy - (lh * t.lines.length) / 2 + lh / 2;
      t.lines.forEach((l, i) => fillText(ctx, l, tx, ty + lh * i, align));
    }
    y += rowH + (idx < feats.length - 1 ? 22 * s : 0);
  });

  return y - y0;
}

/** Average luminance (0-1) of the area where text will sit, used to pick dark or light text. */
export function textAreaLuminance(img: HTMLImageElement, format: FormatId, side: TextSide, W: number, H: number): number {
  const cw = 48;
  const ch = Math.round((48 * H) / W);
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  drawCover(ctx, img, 0, 0, cw, ch);
  const region =
    format === "story"
      ? { x: 0, y: 0, w: cw, h: Math.round(ch * 0.55) }
      : { x: side === "left" ? 0 : Math.round(cw * 0.5), y: 0, w: Math.round(cw * 0.5), h: ch };
  const data = ctx.getImageData(region.x, region.y, region.w, region.h).data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  return sum / (data.length / 4);
}
