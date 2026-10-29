import {
  Apple,
  Award,
  Baby,
  BatteryCharging,
  Brain,
  Check,
  Clock,
  Coffee,
  Droplet,
  Dumbbell,
  Feather,
  Flame,
  Gem,
  Gift,
  Globe,
  Heart,
  HeartPulse,
  Leaf,
  MapPin,
  MessageCircle,
  Music2,
  Package,
  Percent,
  PersonStanding,
  Phone,
  Recycle,
  ShieldCheck,
  Shirt,
  Smartphone,
  Smile,
  Snowflake,
  Sparkles,
  Star,
  Sun,
  Tag,
  Target,
  ThumbsUp,
  Truck,
  Wheat,
  Wrench,
  Zap,
  type IconNode,
} from "lucide";
import type { IconKey } from "../types";

export const FEATURE_ICONS: Record<IconKey, IconNode> = {
  zap: Zap,
  target: Target,
  run: PersonStanding,
  leaf: Leaf,
  shield: ShieldCheck,
  star: Star,
  heart: Heart,
  droplet: Droplet,
  clock: Clock,
  truck: Truck,
  award: Award,
  sparkles: Sparkles,
  check: Check,
  flame: Flame,
  snowflake: Snowflake,
  sun: Sun,
  gift: Gift,
  thumbsUp: ThumbsUp,
  smile: Smile,
  package: Package,
  battery: BatteryCharging,
  dumbbell: Dumbbell,
  brain: Brain,
  apple: Apple,
  coffee: Coffee,
  baby: Baby,
  gem: Gem,
  wrench: Wrench,
  tag: Tag,
  percent: Percent,
  recycle: Recycle,
  wheat: Wheat,
  heartPulse: HeartPulse,
  shirt: Shirt,
  feather: Feather,
};

const InstagramGlyph: IconNode = [
  ["rect", { x: 2, y: 2, width: 20, height: 20, rx: 5 }],
  ["circle", { cx: 12, cy: 12, r: 4 }],
  ["line", { x1: 17.5, y1: 6.5, x2: 17.51, y2: 6.5 }],
];

const FacebookGlyph: IconNode = [
  ["path", { d: "M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" }],
];

export const CONTACT_ICONS = {
  phone: Phone,
  whatsapp: MessageCircle,
  viber: Smartphone,
  address: MapPin,
  instagram: InstagramGlyph,
  facebook: FacebookGlyph,
  tiktok: Music2,
  website: Globe,
} satisfies Record<string, IconNode>;

/** Draws a 24x24 lucide icon centred at (cx, cy) with the given size, as strokes. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  node: IconNode,
  cx: number,
  cy: number,
  size: number,
  color: string,
  strokeWidth = 2,
) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const [tag, rawAttrs] of node) {
    const a = rawAttrs as Record<string, string | number | undefined>;
    const n = (k: string) => Number(a[k] ?? 0);
    let path: Path2D;
    switch (tag) {
      case "path":
        path = new Path2D(String(a.d));
        break;
      case "circle":
        path = new Path2D();
        path.arc(n("cx"), n("cy"), n("r"), 0, Math.PI * 2);
        break;
      case "ellipse":
        path = new Path2D();
        path.ellipse(n("cx"), n("cy"), n("rx"), n("ry"), 0, 0, Math.PI * 2);
        break;
      case "line":
        path = new Path2D(`M${n("x1")} ${n("y1")}L${n("x2")} ${n("y2")}`);
        break;
      case "polyline":
      case "polygon":
        path = new Path2D(`M${String(a.points).trim()}${tag === "polygon" ? "Z" : ""}`);
        break;
      case "rect": {
        path = new Path2D();
        const rx = n("rx");
        if (rx) path.roundRect(n("x"), n("y"), n("width"), n("height"), rx);
        else path.rect(n("x"), n("y"), n("width"), n("height"));
        break;
      }
      default:
        continue;
    }
    ctx.stroke(path);
  }
  ctx.restore();
}
