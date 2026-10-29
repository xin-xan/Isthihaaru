"use client";

import { useState } from "react";
import { ImagePlus, Trash2, Type, X } from "lucide-react";
import { fileToBase64DataUrl, fileToDataUrl } from "@/lib/image";
import { saveProfile, type StoredFont } from "@/lib/storage";
import type { BusinessProfile, ContactVisibility } from "@/lib/types";
import { Field, TextInput, Toggle } from "./ui";

const COLOR_PRESETS: [string, string][] = [
  ["#1B6B2F", "#7CB342"],
  ["#0D47A1", "#29B6F6"],
  ["#B71C1C", "#FF8A65"],
  ["#4A148C", "#BA68C8"],
  ["#E65100", "#FFCA28"],
  ["#004D40", "#26A69A"],
  ["#212121", "#C9A227"],
  ["#880E4F", "#F48FB1"],
];

const CONTACTS: { key: keyof ContactVisibility; label: string; placeholder: string; field: keyof BusinessProfile }[] = [
  { key: "phone", label: "Phone", placeholder: "9755773", field: "phone" },
  { key: "whatsapp", label: "WhatsApp", placeholder: "+960 975 5773", field: "whatsapp" },
  { key: "viber", label: "Viber", placeholder: "+960 975 5773", field: "viber" },
  { key: "instagram", label: "Instagram", placeholder: "@yourshop", field: "instagram" },
  { key: "facebook", label: "Facebook", placeholder: "facebook.com/yourshop", field: "facebook" },
  { key: "tiktok", label: "TikTok", placeholder: "@yourshop", field: "tiktok" },
  { key: "website", label: "Website", placeholder: "yourshop.mv", field: "website" },
];

export default function ProfileDialog({
  initial,
  font,
  onFontChange,
  onClose,
  onSave,
  firstRun,
}: {
  initial: BusinessProfile;
  font: StoredFont | null;
  onFontChange: (font: StoredFont | null) => Promise<string | null>;
  onClose: () => void;
  onSave: (p: BusinessProfile) => void;
  firstRun: boolean;
}) {
  const [p, setP] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof BusinessProfile>(k: K, v: BusinessProfile[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const setShow = (k: keyof ContactVisibility, v: boolean) => setP((prev) => ({ ...prev, show: { ...prev.show, [k]: v } }));

  async function onLogo(file: File | undefined) {
    if (!file) return;
    try {
      set("logo", await fileToDataUrl(file, { maxDim: 600, type: "image/png" }));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onFont(file: File | undefined) {
    if (!file) return;
    if (file.size > 1_500_000) return setError("Font file is too large (max 1.5 MB).");
    const err = await onFontChange({ name: file.name, dataUrl: await fileToBase64DataUrl(file) });
    setError(err);
  }

  function save() {
    if (!saveProfile(p)) {
      setError("Couldn't save in this browser (storage full or blocked). Try a smaller logo.");
      return;
    }
    onSave(p);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[95dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-xl sm:rounded-3xl">
        <header className="flex items-center gap-3 border-b border-neutral-100 px-5 py-4">
          <div className="flex-1">
            <h2 className="text-lg font-bold">{firstRun ? "Set up your business" : "Business details"}</h2>
            <p className="text-xs text-neutral-500">Saved on this device and added to every ad you make.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Close">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {/* Brand */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-brand-700">Brand</h3>
            <div className="flex items-center gap-4">
              <label className="flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 hover:border-brand-500">
                {p.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logo} alt="Logo" className="size-full object-contain p-1" />
                ) : (
                  <span className="flex flex-col items-center text-xs text-neutral-500">
                    <ImagePlus className="mb-1 size-6" />
                    Logo
                  </span>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onLogo(e.target.files?.[0])} />
              </label>
              <div className="flex-1 space-y-2 text-sm">
                <p className="text-neutral-500">A PNG with a transparent background looks best.</p>
                {p.logo && (
                  <>
                    <Toggle checked={p.logoHasName} onChange={(v) => set("logoHasName", v)} label="Logo already shows the business name" />
                    <button type="button" onClick={() => set("logo", null)} className="flex items-center gap-1 text-xs font-semibold text-red-600">
                      <Trash2 className="size-3.5" /> Remove logo
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Business name">
                <TextInput value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="Chaman Plus" />
              </Field>
              <Field label="Slogan">
                <TextInput value={p.slogan} onChange={(e) => set("slogan", e.target.value)} placeholder="High Quality, Low Price" />
              </Field>
              <Field label="Business name (Dhivehi)">
                <TextInput dir="rtl" value={p.nameDv} onChange={(e) => set("nameDv", e.target.value)} placeholder="ޗަމަން ޕްލަސް" />
              </Field>
              <Field label="Slogan (Dhivehi)">
                <TextInput dir="rtl" value={p.sloganDv} onChange={(e) => set("sloganDv", e.target.value)} />
              </Field>
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold text-neutral-600">Brand colours</span>
              <div className="flex flex-wrap items-center gap-2">
                {COLOR_PRESETS.map(([a, b]) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setP((prev) => ({ ...prev, primaryColor: a, accentColor: b }))}
                    className={`flex overflow-hidden rounded-full ring-2 ring-offset-2 ${p.primaryColor === a && p.accentColor === b ? "ring-brand-500" : "ring-transparent"}`}
                    aria-label={`Colours ${a} and ${b}`}
                  >
                    <span className="h-7 w-4" style={{ background: a }} />
                    <span className="h-7 w-4" style={{ background: b }} />
                  </button>
                ))}
                <span className="mx-1 h-6 w-px bg-neutral-200" />
                <label className="flex items-center gap-1 text-xs">
                  <input type="color" value={p.primaryColor} onChange={(e) => set("primaryColor", e.target.value)} className="size-7 cursor-pointer" />
                  Main
                </label>
                <label className="flex items-center gap-1 text-xs">
                  <input type="color" value={p.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="size-7 cursor-pointer" />
                  Accent
                </label>
              </div>
            </div>
          </div>

          {/* Contacts */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-brand-700">Contact details</h3>
            <p className="-mt-2 text-xs text-neutral-500">Tick the ones to show on the post. The phone number appears in the big button.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {CONTACTS.map((c) => (
                <div key={c.key} className="flex items-end gap-2">
                  <div className="flex-1">
                    <Field label={c.label}>
                      <TextInput
                        inputMode={["phone", "whatsapp", "viber"].includes(c.key) ? "tel" : undefined}
                        value={String(p[c.field] ?? "")}
                        onChange={(e) => set(c.field, e.target.value as never)}
                        placeholder={c.placeholder}
                      />
                    </Field>
                  </div>
                  <label className="mb-2.5 flex items-center gap-1 text-xs text-neutral-600">
                    <input type="checkbox" checked={p.show[c.key]} onChange={(e) => setShow(c.key, e.target.checked)} className="size-4 accent-brand-600" />
                    Show
                  </label>
                </div>
              ))}
              <div className="flex items-end gap-2 sm:col-span-2">
                <div className="grid flex-1 gap-3 sm:grid-cols-2">
                  <Field label="Address">
                    <TextInput value={p.address} onChange={(e) => set("address", e.target.value)} placeholder="Majeedhee Magu" />
                  </Field>
                  <Field label="Island / Atoll">
                    <TextInput value={p.island} onChange={(e) => set("island", e.target.value)} placeholder="Malé" />
                  </Field>
                </div>
                <label className="mb-2.5 flex items-center gap-1 text-xs text-neutral-600">
                  <input type="checkbox" checked={p.show.address} onChange={(e) => setShow("address", e.target.checked)} className="size-4 accent-brand-600" />
                  Show
                </label>
              </div>
            </div>
          </div>

          {/* Taglines */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-brand-700">Taglines on every post</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Top corner text">
                <TextInput value={p.topTagline} onChange={(e) => set("topTagline", e.target.value)} placeholder="Your trusted shopping partner" />
              </Field>
              <Field label="Top corner text (Dhivehi)">
                <TextInput dir="rtl" value={p.topTaglineDv} onChange={(e) => set("topTaglineDv", e.target.value)} />
              </Field>
              <Field label="Bottom corner text">
                <TextInput value={p.footerTagline} onChange={(e) => set("footerTagline", e.target.value)} placeholder="Quality Products at Great Prices" />
              </Field>
              <Field label="Bottom corner text (Dhivehi)">
                <TextInput dir="rtl" value={p.footerTaglineDv} onChange={(e) => set("footerTaglineDv", e.target.value)} />
              </Field>
            </div>
          </div>

          {/* Font */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-brand-700">Dhivehi font</h3>
            <p className="text-xs text-neutral-500">
              Uses Noto Sans Thaana by default. You can upload your own Thaana font, such as MV Faseyha or Faruma (.ttf, .otf or .woff).
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-neutral-100 px-3 py-2 text-sm font-semibold hover:bg-neutral-200">
                <Type className="size-4" /> {font ? "Change font" : "Upload font"}
                <input type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => onFont(e.target.files?.[0])} />
              </label>
              {font && (
                <>
                  <span className="text-sm text-neutral-600">{font.name}</span>
                  <button type="button" onClick={() => onFontChange(null)} className="text-xs font-semibold text-red-600">
                    Use default
                  </button>
                </>
              )}
            </div>
          </div>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </div>

        <footer className="flex gap-3 border-t border-neutral-100 px-5 py-4">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-neutral-100 py-3 font-semibold hover:bg-neutral-200">
            {firstRun ? "Skip for now" : "Cancel"}
          </button>
          <button type="button" onClick={save} className="flex-[2] rounded-xl bg-brand-700 py-3 font-bold text-white hover:bg-brand-900">
            Save details
          </button>
        </footer>
      </div>
    </div>
  );
}
