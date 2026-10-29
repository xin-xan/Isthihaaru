"use client";

import { ChevronDown } from "lucide-react";
import { ICON_KEYS, type AdCopy, type IconKey, type Lang } from "@/lib/types";
import { FEATURE_ICONS } from "@/lib/poster/icons";
import { Field, TextArea, TextInput } from "./ui";

const ICON_LABELS: Record<IconKey, string> = {
  zap: "Energy",
  target: "Focus",
  run: "Active",
  leaf: "Natural",
  shield: "Protection",
  star: "Quality",
  heart: "Love",
  droplet: "Water / Fresh",
  clock: "Long-lasting",
  truck: "Delivery",
  award: "Award",
  sparkles: "Shine",
  check: "Check",
  flame: "Hot / Spicy",
  snowflake: "Cool",
  sun: "Sun",
  gift: "Gift",
  thumbsUp: "Recommended",
  smile: "Happy",
  package: "Package",
  battery: "Power",
  dumbbell: "Strength",
  brain: "Mind",
  apple: "Healthy",
  coffee: "Coffee",
  baby: "Kids",
  gem: "Premium",
  wrench: "Tools",
  tag: "Price",
  percent: "Discount",
  recycle: "Eco",
  wheat: "Grain",
  heartPulse: "Health",
  shirt: "Fashion",
  feather: "Light",
};

function IconPreview({ icon }: { icon: IconKey }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-brand-700" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {FEATURE_ICONS[icon].map(([tag, attrs], i) => {
        const Tag = tag as "path";
        return <Tag key={i} {...(attrs as Record<string, string>)} />;
      })}
    </svg>
  );
}

export default function CopyEditor({ copy, lang, onChange }: { copy: AdCopy; lang: Lang; onChange: (c: AdCopy) => void }) {
  const dir = lang === "dv" ? "rtl" : "ltr";
  const set = <K extends keyof AdCopy>(k: K, v: AdCopy[K]) => onChange({ ...copy, [k]: v });
  const setFeature = (i: number, patch: Partial<AdCopy["features"][number]>) =>
    set(
      "features",
      copy.features.map((f, j) => (j === i ? { ...f, ...patch } : f)),
    );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <TextInput dir={dir} value={copy.category} onChange={(e) => set("category", e.target.value)} placeholder="Energy drink" />
        </Field>
        <Field label="Product name">
          <TextInput dir={dir} value={copy.name} onChange={(e) => set("name", e.target.value)} placeholder="Shark" />
        </Field>
      </div>
      <Field label="Subtitle">
        <TextInput dir={dir} value={copy.subtitle} onChange={(e) => set("subtitle", e.target.value)} placeholder="Energy Drink" />
      </Field>
      <Field label="Tagline" hint="Press Enter to start a new line.">
        <TextArea dir={dir} value={copy.tagline} onChange={(e) => set("tagline", e.target.value)} placeholder={"More Energy.\nMore You."} />
      </Field>
      <div>
        <span className="mb-1 block text-xs font-semibold text-neutral-600">Features</span>
        <div className="space-y-2">
          {copy.features.map((f, i) => (
            <div key={i} className="flex items-center gap-2">
              <label className="relative flex shrink-0 items-center gap-0.5 rounded-xl border border-neutral-200 bg-neutral-50 px-2 py-2.5 focus-within:ring-2 focus-within:ring-brand-100">
                <IconPreview icon={f.icon} />
                <ChevronDown className="size-3.5 text-neutral-400" />
                <select
                  value={f.icon}
                  onChange={(e) => setFeature(i, { icon: e.target.value as IconKey })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label={`Feature ${i + 1} icon`}
                >
                  {ICON_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {ICON_LABELS[k]}
                    </option>
                  ))}
                </select>
              </label>
              <TextInput dir={dir} value={f.text} onChange={(e) => setFeature(i, { text: e.target.value })} placeholder={`Feature ${i + 1}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
