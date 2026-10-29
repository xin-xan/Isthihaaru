"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Download, ImageUp, RefreshCw, Settings2, Share2, Sparkles, Store, Wand2 } from "lucide-react";
import CopyEditor from "./CopyEditor";
import PosterPreview from "./PosterPreview";
import ProfileDialog from "./ProfileDialog";
import { Chip, Field, Section, Segmented, Spinner, TextArea, TextInput, Toggle } from "./ui";
import { FORMATS, FORMAT_LIST } from "@/lib/formats";
import { removeBackground } from "@/lib/bgremove";
import { fileToDataUrl } from "@/lib/image";
import { DEFAULT_THAANA, type ProductPlacement } from "@/lib/poster/render";
import { SCENE_PRESETS } from "@/lib/presets";
import {
  DEFAULT_PROFILE,
  loadAccessCode,
  loadProfile,
  loadThaanaFont,
  saveAccessCode,
  saveThaanaFont,
  type StoredFont,
} from "@/lib/storage";
import type { AdCopy, BusinessProfile, CopyResponse, FormatId, Lang, PriceInfo, SceneEngine, TextSide, ThemeMode } from "@/lib/types";

const CUSTOM_THAANA = "IsthihaaruThaana";

const emptyCopy = (): AdCopy => ({
  category: "",
  name: "",
  subtitle: "",
  tagline: "",
  features: [
    { icon: "star", text: "" },
    { icon: "check", text: "" },
    { icon: "thumbsUp", text: "" },
  ],
});

interface SceneEntry {
  url: string;
  side: TextSide;
}

class RequestError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export default function Studio() {
  const [profile, setProfile] = useState<BusinessProfile>(DEFAULT_PROFILE);
  const [profileOpen, setProfileOpen] = useState(false);
  const [firstRun, setFirstRun] = useState(false);
  const [thaanaFont, setThaanaFont] = useState<StoredFont | null>(null);
  const [thaanaFamily, setThaanaFamily] = useState(DEFAULT_THAANA);
  const [fontsVersion, setFontsVersion] = useState(0);

  const [photo, setPhoto] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [details, setDetails] = useState("");
  const [presetId, setPresetId] = useState("auto");
  const [customScene, setCustomScene] = useState("");

  const [format, setFormat] = useState<FormatId>("portrait");
  const [lang, setLang] = useState<Lang>("en");
  const [textSide, setTextSide] = useState<TextSide>("left");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [scrim, setScrim] = useState(true);
  const [price, setPrice] = useState<PriceInfo>({ show: false, currency: "MVR", price: "", oldPrice: "" });

  const [engines, setEngines] = useState({ premium: true, free: true });
  const [engine, setEngine] = useState<SceneEngine>("free");
  const [notice, setNotice] = useState<string | null>(null);
  const [scenes, setScenes] = useState<Partial<Record<FormatId, SceneEntry>>>({});
  // Free mode: one empty background plate (works for every size) + the cut-out product placed on it.
  const [freeBg, setFreeBg] = useState<SceneEntry | null>(null);
  const [cutout, setCutout] = useState<{ photo: string; url: string } | null>(null);
  const [placement, setPlacement] = useState<ProductPlacement>({ scale: 1, lift: 0 });
  const [sceneStatus, setSceneStatus] = useState("");
  const [copy, setCopy] = useState<CopyResponse>({ en: emptyCopy(), dv: emptyCopy() });
  const [hasCopy, setHasCopy] = useState(false);

  const [busyScene, setBusyScene] = useState(false);
  const [busyCopy, setBusyCopy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [canShare, setCanShare] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const copyInFlight = useRef<Promise<CopyResponse | null> | null>(null);

  // ---------- boot: profile, access code, fonts ----------
  const applyFont = useCallback(async (font: StoredFont | null): Promise<string | null> => {
    if (!font) {
      setThaanaFont(null);
      setThaanaFamily(DEFAULT_THAANA);
      saveThaanaFont(null);
      setFontsVersion((v) => v + 1);
      return null;
    }
    try {
      const face = new FontFace(CUSTOM_THAANA, `url(${font.dataUrl})`);
      await face.load();
      document.fonts.add(face);
      setThaanaFont(font);
      setThaanaFamily(`"${CUSTOM_THAANA}", ${DEFAULT_THAANA}`);
      setFontsVersion((v) => v + 1);
      return saveThaanaFont(font) ? null : "Font applied, but it's too large to remember on this device.";
    } catch {
      return "That font file couldn't be loaded.";
    }
  }, []);

  useEffect(() => {
    const stored = loadProfile();
    if (stored) setProfile(stored);
    else {
      setFirstRun(true);
      setProfileOpen(true);
    }
    setAccessCode(loadAccessCode());
    setCanShare("share" in navigator);
    const font = loadThaanaFont();
    if (font) void applyFont(font);

    const specs = [
      "400 20px Montserrat",
      "500 20px Montserrat",
      "600 20px Montserrat",
      "700 20px Montserrat",
      "800 20px Montserrat",
      "italic 600 20px Montserrat",
      "400 20px 'Kaushan Script'",
      "400 20px 'Noto Sans Thaana'",
      "700 20px 'Noto Sans Thaana'",
    ];
    Promise.allSettled(specs.map((s) => document.fonts.load(s, "Aa ދިވެހި"))).then(() => setFontsVersion((v) => v + 1));

    fetch("/api/config")
      .then((r) => r.json())
      .then((c: { premium: boolean; free: boolean }) => {
        setEngines(c);
        if (!c.free && c.premium) setEngine("premium");
      })
      .catch(() => {});
  }, [applyFont]);

  // ---------- API ----------
  async function post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(accessCode ? { "x-access-code": accessCode } : {}) },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new RequestError(data.error || `Request failed (${res.status})`, data.code);
    return data as T;
  }

  function handleError(e: unknown) {
    if (e instanceof RequestError && e.code === "access_code_required") setNeedCode(true);
    setError(e instanceof Error ? e.message : "Something went wrong.");
  }

  async function makeScene(target: FormatId = format) {
    if (!photo) return;
    setBusyScene(true);
    setSceneStatus("Creating your scene… (10–30 s)");
    setError(null);
    try {
      const { dataUrl } = await post<{ dataUrl: string }>("/api/scene", {
        image: photo,
        format: target,
        presetId,
        customScene,
        textSide,
        productName: productName || copy.en.name,
      });
      setScenes((s) => ({ ...s, [target]: { url: dataUrl, side: textSide } }));
    } catch (e) {
      if (e instanceof RequestError && e.code === "billing_required" && engines.free) {
        setEngine("free");
        setNotice("Premium scenes need Gemini billing, so we switched to Free mode.");
        setBusyScene(false);
        return makeFreeScene();
      }
      handleError(e);
    } finally {
      setBusyScene(false);
    }
  }

  async function ensureCutout(src: string): Promise<string> {
    if (cutout?.photo === src) return cutout.url;
    const url = await removeBackground(src);
    setCutout({ photo: src, url });
    return url;
  }

  async function makeFreeScene() {
    if (!photo) return;
    setBusyScene(true);
    setSceneStatus("Cutting out your product…");
    setError(null);
    try {
      const [, c] = await Promise.all([ensureCutout(photo), hasCopy ? Promise.resolve(copy) : makeCopy()]);
      setSceneStatus("Creating the background…");
      const { dataUrl } = await post<{ dataUrl: string }>("/api/background", {
        format,
        presetId,
        customScene,
        textSide,
        sceneIdea: c?.sceneIdea ?? "",
      });
      setFreeBg({ url: dataUrl, side: textSide });
    } catch (e) {
      handleError(e);
    } finally {
      setBusyScene(false);
    }
  }

  function makeCopy(): Promise<CopyResponse | null> {
    copyInFlight.current ??= requestCopy().finally(() => {
      copyInFlight.current = null;
    });
    return copyInFlight.current;
  }

  async function requestCopy(): Promise<CopyResponse | null> {
    if (!photo) return null;
    setBusyCopy(true);
    setError(null);
    try {
      const res = await post<CopyResponse>("/api/copy", { image: photo, productName, details, businessName: profile.name });
      setCopy(res);
      setHasCopy(true);
      return res;
    } catch (e) {
      handleError(e);
      return null;
    } finally {
      setBusyCopy(false);
    }
  }

  async function createAd() {
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setNotice(null);
    if (engine === "free") await makeFreeScene();
    else await Promise.all([makeScene(), hasCopy ? Promise.resolve() : makeCopy()]);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const url = await fileToDataUrl(file, { maxDim: 1536, type: "image/jpeg", quality: 0.9 });
      setPhoto(url);
      setScenes({});
      setFreeBg(null);
      setCutout(null);
      setPlacement({ scale: 1, lift: 0 });
      // Cut the product out straight away in free mode so the preview shows it while the user picks a scene.
      if (engine === "free") {
        removeBackground(url)
          .then((cut) => setCutout({ photo: url, url: cut }))
          .catch(() => {});
      }
      setHasCopy(false);
      setCopy({ en: emptyCopy(), dv: emptyCopy() });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  // ---------- export ----------
  const fileName = () => `${(copy.en.name || profile.name || "ad").replace(/[^\w-]+/g, "-").toLowerCase()}-${format}.png`;

  function toBlob(): Promise<Blob | null> {
    return new Promise((resolve) => (canvasRef.current ? canvasRef.current.toBlob(resolve, "image/png") : resolve(null)));
  }

  async function download() {
    const blob = await toBlob();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName();
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  async function share() {
    const blob = await toBlob();
    if (!blob) return;
    const file = new File([blob], fileName(), { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: copy[lang].name || profile.name });
      } catch {
        /* user cancelled */
      }
    } else void download();
  }

  // ---------- derived ----------
  const free = engine === "free";
  const sceneEntry = free ? freeBg : (scenes[format] ?? Object.values(scenes)[0] ?? null);
  const sceneForOtherSize = !free && !!sceneEntry && !scenes[format];
  const sceneSideMismatch = !free && !!scenes[format] && scenes[format]!.side !== textSide;
  const cutoutUrl = free && cutout?.photo === photo ? cutout.url : null;
  const busy = busyScene || busyCopy;
  const started = !!sceneEntry || hasCopy || busy;

  function changeLang(l: Lang) {
    setLang(l);
    // Dhivehi reads right-to-left, so default its text block to the right side.
    if (!sceneEntry) setTextSide(l === "dv" ? "right" : "left");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:pb-10">
      {/* Top bar */}
      <header className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-700 text-white">
          <Sparkles className="size-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-extrabold leading-tight">Isthihaaru</h1>
          <p className="text-xs text-neutral-500">
            Professional ad posts in seconds · <span className="thaana">އިސްތިހާރު</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-semibold shadow-sm ring-1 ring-black/5 hover:bg-neutral-50"
        >
          {profile.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logo} alt="" className="size-6 rounded object-contain" />
          ) : (
            <Store className="size-4" />
          )}
          <span className="max-w-28 truncate">{profile.name || "My business"}</span>
        </button>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        {/* Preview */}
        <div ref={editorRef} className="scroll-mt-4 lg:sticky lg:top-4 lg:self-start">
          <div className="relative mx-auto" style={{ maxWidth: format === "story" ? 420 : format === "landscape" ? 900 : 620 }}>
            <PosterPreview
              canvasRef={canvasRef}
              sceneUrl={sceneEntry?.url ?? null}
              photoUrl={photo}
              cutoutUrl={cutoutUrl}
              hybrid={free}
              placement={placement}
              themeMode={themeMode}
              fontsVersion={fontsVersion}
              format={format}
              profile={profile}
              copy={copy[lang]}
              lang={lang}
              textSide={textSide}
              scrim={scrim}
              price={price}
              thaanaFamily={thaanaFamily}
            />
            {busy && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-white/60 backdrop-blur-sm">
                <Spinner className="size-8 text-brand-700" />
                <p className="text-sm font-semibold text-brand-900">
                  {busyScene ? sceneStatus : "Writing your ad copy…"}
                </p>
              </div>
            )}
            {!photo && (
              <div className="pointer-events-none absolute inset-x-0 bottom-1/3 text-center text-sm font-semibold text-neutral-500">
                Upload a product photo to start
              </div>
            )}
          </div>

          {(sceneForOtherSize || sceneSideMismatch) && !busyScene && (
            <div className="mx-auto mt-3 flex max-w-xl items-center gap-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span className="flex-1">
                {sceneForOtherSize
                  ? `This scene was made for another size. Create one for ${FORMATS[format].label} for the best fit.`
                  : "The text side changed. Recreate the scene so the product sits on the other side."}
              </span>
              <button type="button" onClick={() => makeScene()} className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-white">
                Recreate
              </button>
            </div>
          )}

          {/* Export (desktop) */}
          {started && (
            <div className="mx-auto mt-4 hidden max-w-xl gap-3 sm:flex">
              <button type="button" onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-bold text-white hover:bg-brand-900">
                <Download className="size-5" /> Download PNG
              </button>
              {canShare && (
                <button type="button" onClick={share} className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold shadow-sm ring-1 ring-black/10">
                  <Share2 className="size-5" /> Share
                </button>
              )}
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="space-y-4">
          {notice && <div className="rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-900 ring-1 ring-sky-200">{notice}</div>}
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200">
              <p>{error}</p>
              {needCode && (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveAccessCode(accessCode);
                    setNeedCode(false);
                    setError(null);
                  }}
                >
                  <TextInput value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Access code" className="bg-white" />
                  <button className="rounded-xl bg-red-700 px-4 font-semibold text-white">Save</button>
                </form>
              )}
            </div>
          )}

          <Section step={1} title="Product photo">
            {photo ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Product" className="size-20 rounded-xl object-cover ring-1 ring-black/10" />
                <div className="flex flex-1 flex-wrap gap-2">
                  <PhotoButton capture onFile={onPhoto} small>
                    <Camera className="size-4" /> Retake
                  </PhotoButton>
                  <PhotoButton onFile={onPhoto} small>
                    <ImageUp className="size-4" /> Change
                  </PhotoButton>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <PhotoButton capture onFile={onPhoto}>
                  <Camera className="size-7" /> Take photo
                </PhotoButton>
                <PhotoButton onFile={onPhoto}>
                  <ImageUp className="size-7" /> From gallery
                </PhotoButton>
              </div>
            )}
            <details className="group mt-3">
              <summary className="cursor-pointer text-sm font-semibold text-brand-700">Help the AI (optional)</summary>
              <div className="mt-3 space-y-3">
                <Field label="Product name">
                  <TextInput value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Shark Energy Drink 250ml" />
                </Field>
                <Field label="Anything to mention?">
                  <TextArea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. New stock, best served cold, available in all branches" />
                </Field>
              </div>
            </details>
          </Section>

          <Section step={2} title="Scene & size">
            <div className="mb-3">
              <Segmented
                value={engine}
                onChange={(v) => {
                  setEngine(v);
                  setNotice(null);
                  if (v === "free" && photo && cutout?.photo !== photo) {
                    removeBackground(photo)
                      .then((cut) => setCutout({ photo, url: cut }))
                      .catch(() => {});
                  }
                }}
                options={[
                  { value: "free", label: "Free" },
                  { value: "premium", label: "Premium" },
                ]}
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                {free
                  ? "Your product is cut out on this device and placed on an AI-made background. The label stays exactly as photographed."
                  : "Gemini re-renders the whole photo with matching light and reflections. Needs Gemini billing."}
              </p>
              {free && !engines.free && (
                <p className="mt-1.5 text-xs font-semibold text-amber-700">Free mode isn&apos;t set up on the server yet (Cloudflare keys missing).</p>
              )}
              {!free && !engines.premium && (
                <p className="mt-1.5 text-xs font-semibold text-amber-700">Premium mode isn&apos;t set up on the server yet (Gemini key missing).</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {SCENE_PRESETS.map((p) => (
                <Chip key={p.id} active={presetId === p.id && !customScene.trim()} onClick={() => (setPresetId(p.id), setCustomScene(""))}>
                  <span className="mr-1">{p.emoji}</span>
                  {p.label}
                </Chip>
              ))}
            </div>
            <div className="mt-3">
              <TextInput value={customScene} onChange={(e) => setCustomScene(e.target.value)} placeholder="Or describe a scene: on a wooden table with coconuts…" />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {FORMAT_LIST.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  aria-pressed={format === f.id}
                  className={`flex flex-col items-center gap-1 rounded-xl py-2 text-xs font-semibold transition ${
                    format === f.id ? "bg-brand-50 text-brand-700 ring-2 ring-brand-500" : "bg-neutral-50 text-neutral-600 ring-1 ring-neutral-200"
                  }`}
                >
                  <span className="flex h-8 items-center">
                    <span className="block rounded-sm border-2 border-current" style={{ width: (f.width / Math.max(f.width, f.height)) * 26, height: (f.height / Math.max(f.width, f.height)) * 26 }} />
                  </span>
                  {f.label}
                  <span className="text-[10px] font-medium opacity-70">{f.hint}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={!photo || busy}
              onClick={createAd}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Spinner className="size-5" /> : <Wand2 className="size-5" />}
              {sceneEntry ? (free ? "New background" : "Create new scene") : "Create my ad"}
            </button>
          </Section>

          <Section
            step={3}
            title="Text"
            right={
              <button
                type="button"
                disabled={!photo || busyCopy}
                onClick={makeCopy}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40"
              >
                {busyCopy ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />} {hasCopy ? "Rewrite" : "Write with AI"}
              </button>
            }
          >
            <div className="mb-3">
              <Segmented
                value={lang}
                onChange={changeLang}
                options={[
                  { value: "en", label: "English" },
                  { value: "dv", label: <span className="thaana">ދިވެހި</span> },
                ]}
              />
            </div>
            <CopyEditor copy={copy[lang]} lang={lang} onChange={(c) => setCopy((prev) => ({ ...prev, [lang]: c }))} />

            <div className="mt-4 rounded-xl bg-neutral-50 p-3">
              <Toggle checked={price.show} onChange={(v) => setPrice((p) => ({ ...p, show: v }))} label={<span className="font-semibold">Show price badge</span>} />
              {price.show && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Field label="Currency">
                    <TextInput value={price.currency} onChange={(e) => setPrice((p) => ({ ...p, currency: e.target.value }))} />
                  </Field>
                  <Field label="Price">
                    <TextInput inputMode="decimal" value={price.price} onChange={(e) => setPrice((p) => ({ ...p, price: e.target.value }))} placeholder="15" />
                  </Field>
                  <Field label="Old price">
                    <TextInput inputMode="decimal" value={price.oldPrice} onChange={(e) => setPrice((p) => ({ ...p, oldPrice: e.target.value }))} placeholder="20" />
                  </Field>
                </div>
              )}
            </div>
          </Section>

          <Section step={4} title="Layout" right={<Settings2 className="size-4 text-neutral-400" />}>
            <div className="space-y-3">
              <Field label="Text side">
                <Segmented
                  value={textSide}
                  onChange={setTextSide}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "right", label: "Right" },
                  ]}
                />
              </Field>
              <Field label="Text colour">
                <Segmented
                  value={themeMode}
                  onChange={setThemeMode}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "dark", label: "Dark" },
                    { value: "light", label: "Light" },
                  ]}
                />
              </Field>
              <Toggle checked={scrim} onChange={setScrim} label="Soft backdrop behind text" />
              {cutoutUrl && (
                <div className="space-y-3 rounded-xl bg-neutral-50 p-3">
                  <Field label="Product size">
                    <input
                      type="range"
                      min={0.6}
                      max={1.4}
                      step={0.02}
                      value={placement.scale}
                      onChange={(e) => setPlacement((p) => ({ ...p, scale: Number(e.target.value) }))}
                      className="w-full accent-brand-600"
                    />
                  </Field>
                  <Field label="Product height">
                    <input
                      type="range"
                      min={-0.08}
                      max={0.3}
                      step={0.005}
                      value={placement.lift}
                      onChange={(e) => setPlacement((p) => ({ ...p, lift: Number(e.target.value) }))}
                      className="w-full accent-brand-600"
                    />
                  </Field>
                </div>
              )}
              <button type="button" onClick={() => setProfileOpen(true)} className="text-sm font-semibold text-brand-700">
                Edit business details, colours & logo →
              </button>
            </div>
          </Section>
        </div>
      </div>

      {/* Export (mobile) */}
      {started && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-black/5 bg-white/95 px-4 py-3 backdrop-blur sm:hidden">
          <button type="button" onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-bold text-white">
            <Download className="size-5" /> Save
          </button>
          {canShare && (
            <button type="button" onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-100 py-3 font-bold">
              <Share2 className="size-5" /> Share
            </button>
          )}
        </div>
      )}

      {profileOpen && (
        <ProfileDialog
          initial={profile}
          firstRun={firstRun}
          font={thaanaFont}
          onFontChange={applyFont}
          onClose={() => {
            setProfileOpen(false);
            setFirstRun(false);
          }}
          onSave={(p) => {
            setProfile(p);
            setProfileOpen(false);
            setFirstRun(false);
          }}
        />
      )}
    </div>
  );
}

function PhotoButton({
  capture,
  onFile,
  children,
  small,
}: {
  capture?: boolean;
  onFile: (f: File | undefined) => void;
  children: React.ReactNode;
  small?: boolean;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center justify-center gap-2 font-semibold transition ${
        small
          ? "rounded-lg bg-neutral-100 px-3 py-2 text-sm hover:bg-neutral-200"
          : "flex-col rounded-2xl border-2 border-dashed border-brand-500/40 bg-brand-50 py-6 text-brand-700 hover:border-brand-500"
      }`}
    >
      {children}
      <input
        type="file"
        accept="image/*"
        capture={capture ? "environment" : undefined}
        className="hidden"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </label>
  );
}
