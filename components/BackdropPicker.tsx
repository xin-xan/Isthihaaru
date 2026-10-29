"use client";

import { useEffect, useRef } from "react";
import { ImagePlus } from "lucide-react";
import { BACKDROPS, type Backdrop } from "@/lib/poster/backdrops";
import type { BusinessProfile } from "@/lib/types";

const TW = 160;
const TH = 200;

function Thumb({ backdrop, profile, left }: { backdrop: Backdrop; profile: BusinessProfile; left: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = TW;
    canvas.height = TH;
    const ctx = canvas.getContext("2d")!;
    const u = Math.min(TW, TH) / 1080;
    const product = { cx: (left ? 0.68 : 0.32) * TW, baseY: 0.78 * TH, w: TW * 0.2, h: TH * 0.36 };
    backdrop.draw(ctx, { W: TW, H: TH, u, left, primary: profile.primaryColor, accent: profile.accentColor, product });
    // stand-in product so the pedestal reads as a stage
    ctx.fillStyle = backdrop.dark ? "rgba(255,255,255,0.75)" : "rgba(40,40,40,0.55)";
    ctx.beginPath();
    ctx.roundRect(product.cx - product.w / 2, product.baseY - product.h, product.w, product.h, product.w * 0.25);
    ctx.fill();
  }, [backdrop, profile.primaryColor, profile.accentColor, left]);
  return <canvas ref={ref} className="block aspect-[4/5] w-full" />;
}

export default function BackdropPicker({
  selected,
  customBg,
  profile,
  left,
  onSelect,
  onCustom,
}: {
  selected: string;
  customBg: string | null;
  profile: BusinessProfile;
  left: boolean;
  onSelect: (id: string) => void;
  onCustom: (file: File | undefined) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
      {BACKDROPS.map((b) => (
        <button
          key={b.id}
          type="button"
          onClick={() => onSelect(b.id)}
          aria-pressed={selected === b.id}
          className={`overflow-hidden rounded-xl text-left ring-offset-1 transition ${selected === b.id ? "ring-2 ring-brand-600" : "ring-1 ring-black/10 hover:ring-black/25"}`}
        >
          <Thumb backdrop={b} profile={profile} left={left} />
          <span className="block truncate bg-white px-2 py-1 text-[11px] font-semibold">{b.label}</span>
        </button>
      ))}
      <label
        className={`flex cursor-pointer flex-col overflow-hidden rounded-xl ring-offset-1 transition ${selected === "custom" ? "ring-2 ring-brand-600" : "ring-1 ring-black/10 hover:ring-black/25"}`}
      >
        <span className="flex aspect-[4/5] w-full items-center justify-center bg-neutral-100 text-neutral-500">
          {customBg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={customBg} alt="Your background" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-7" />
          )}
        </span>
        <span className="block truncate bg-white px-2 py-1 text-[11px] font-semibold">Your photo</span>
        <input
          id="custom-background"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            onCustom(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
