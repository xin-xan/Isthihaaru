"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Copy, Download, ImageUp, RefreshCw, Settings2, Share2, Shuffle, Sparkles, Store, Wand2, X } from "lucide-react";
import CopyEditor from "./CopyEditor";
import PosterPreview from "./PosterPreview";
import ProfileDialog from "./ProfileDialog";
import { Chip, Field, Section, Segmented, Spinner, TextArea, TextInput, Toggle } from "./ui";
import { cutOutProduct } from "@/lib/bgremove";
import { COPY_CATEGORIES, findCategory, templateCopy } from "@/lib/copybank";
import { FORMATS, FORMAT_LIST } from "@/lib/formats";
import { fileToDataUrl } from "@/lib/image";
import { BACKDROPS } from "@/lib/poster/backdrops";
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
import type { BusinessProfile, CopyResponse, FormatId, Lang, PriceInfo, SceneEngine, TextSide, ThemeMode } from "@/lib/types";
import BackdropPicker from "./BackdropPicker";

declare global {
  interface Window {
    /** Present only when the page runs inside a claude.ai artifact viewer. */
    claude?: {
      use?: (name: "downloads") => Promise<{ save(r: { filename: string; data: Blob }): Promise<{ status: string }> } | null>;
    };
  }
}

/** Set by scripts/build-static.mjs: no server, so only the built-in engine exists. */
const STATIC_BUILD = process.env.NEXT_PUBLIC_STATIC_BUILD === "1";
const CUSTOM_THAANA = "IsthihaaruThaana";
const EXAMPLE_PRODUCT = "examples/sample-product.webp";

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

  const [format, setFormat] = useState<FormatId>("portrait");
  const [lang, setLang] = useState<Lang>("en");
  const [textSide, setTextSide] = useState<TextSide>("left");
  const [themeMode, setThemeMode] = useState<ThemeMode>("auto");
  const [scrim, setScrim] = useState(true);
  const [price, setPrice] = useState<PriceInfo>({ show: false, currency: "MVR", price: "", oldPrice: "" });

  // Scene engines: built-in canvas scenes (always), Cloudflare background ("free"), Gemini re-render ("premium").
  const [engines, setEngines] = useState({ premium: false, free: false });
  const [engine, setEngine] = useState<SceneEngine>("local");
  const [backdropId, setBackdropId] = useState("natural");
  const [backdropTouched, setBackdropTouched] = useState(false);
  const [customBg, setCustomBg] = useState<string | null>(null);
  const [presetId, setPresetId] = useState("auto");
  const [customScene, setCustomScene] = useState("");
  const [scenes, setScenes] = useState<Partial<Record<FormatId, SceneEntry>>>({});
  const [freeBg, setFreeBg] = useState<SceneEntry | null>(null);
  const [cutout, setCutout] = useState<{ photo: string; url: string; stage: "quick" | "best" } | null>(null);
  const [placement, setPlacement] = useState<ProductPlacement>({ scale: 1, lift: 0 });

  const [category, setCategory] = useState("general");
  const [variant, setVariant] = useState(0);
  const [copy, setCopy] = useState<CopyResponse>(() => templateCopy("general", "", 0));

  const [busyScene, setBusyScene] = useState(false);
  const [busyCopy, setBusyCopy] = useState(false);
  const [cutting, setCutting] = useState(false);
  const [improving, setImproving] = useState(false);
  const [bestCutout, setBestCutout] = useState(true);
  const [sceneStatus, setSceneStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [needCode, setNeedCode] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const copyInFlight = useRef<Promise<CopyResponse | null> | null>(null);

  // ---------- boot: profile, access code, fonts, server engines ----------
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
    try {
      if (window.localStorage.getItem("isthihaaru.bestCutout") === "0") setBestCutout(false);
    } catch {
      /* storage unavailable */
    }
    setCanShare(!STATIC_BUILD && "share" in navigator);
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

    if (!STATIC_BUILD) {
      fetch("/api/config")
        .then((r) => r.json())
        .then((c: { premium: boolean; free: boolean }) => setEngines(c))
        .catch(() => {});
    }
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

  // ---------- product cut-out ----------
  /** Resolves with the quick cut-out; the best-quality one replaces it in state when ready. */
  function cutOut(src: string, best = bestCutout): Promise<string> {
    if (cutout?.photo === src && (cutout.stage === "best" || !best)) return Promise.resolve(cutout.url);
    setCutting(true);
    setImproving(false);
    return new Promise((resolve) => {
      void cutOutProduct(src, {
        best,
        onResult(stage, url) {
          setCutout({ photo: src, url, stage });
          if (stage === "quick") {
            setCutting(false);
            resolve(url);
          } else setImproving(false);
        },
        onImproving: () => setImproving(true),
        onError(message, stage) {
          console.error(message);
          setImproving(false);
          if (stage === "best") {
            // Keep the quick result; say once why the cleaner version didn't arrive.
            setNotice(`The best-quality cut-out isn't available on this device, so the quick one is used. Details: ${message}`);
            return;
          }
          setCutting(false);
          // Keep going with the photo as it is rather than blocking the whole poster.
          setNotice(
            message.startsWith("Couldn't find")
              ? `${message} The photo is used as it is for now.`
              : `Couldn't remove this photo's background here, so it's used as it is. A photo on a plain, even background works on every phone. Details: ${message}`,
          );
          setCutout({ photo: src, url: src, stage: "quick" });
          resolve(src);
        },
      });
    });
  }

  // ---------- AI engines (only when the server has keys) ----------
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
      if (e instanceof RequestError && e.code === "billing_required") {
        setEngine(engines.free ? "free" : "local");
        setNotice(`AI scenes need Gemini billing, so we switched to ${engines.free ? "AI background" : "built-in scenes"}.`);
        setBusyScene(false);
        return engines.free ? makeFreeScene() : undefined;
      }
      handleError(e);
    } finally {
      setBusyScene(false);
    }
  }

  async function makeFreeScene() {
    if (!photo) return;
    setBusyScene(true);
    setSceneStatus("Creating the background…");
    setError(null);
    try {
      const [, c] = await Promise.all([cutOut(photo), engines.premium ? makeCopy() : Promise.resolve(null)]);
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
      return res;
    } catch (e) {
      handleError(e);
      return null;
    } finally {
      setBusyCopy(false);
    }
  }

  async function createAi() {
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setNotice(null);
    if (engine === "free") await makeFreeScene();
    else await Promise.all([makeScene(), makeCopy()]);
  }

  // ---------- built-in text ----------
  function applyTemplate(cat: string, v: number) {
    const t = templateCopy(cat, "", v);
    // Keep whatever product name the user already has.
    setCopy((prev) => ({
      en: { ...t.en, name: prev.en.name },
      dv: { ...t.dv, name: prev.dv.name || prev.en.name },
    }));
  }

  function chooseCategory(id: string) {
    setCategory(id);
    setVariant(0);
    applyTemplate(id, 0);
    if (!backdropTouched && !customBg) setBackdropId(findCategory(id).backdrop);
  }

  function shuffleText() {
    const v = variant + 1;
    setVariant(v);
    applyTemplate(category, v);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    setError(null);
    setNotice(null);
    try {
      const url = await fileToDataUrl(file, { maxDim: 1536, type: "image/jpeg", quality: 0.9 });
      setPhoto(url);
      setScenes({});
      setFreeBg(null);
      setPlacement({ scale: 1, lift: 0 });
      if (engine !== "premium") void cutOut(url);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onCustomBg(file: File | undefined) {
    if (!file) return;
    try {
      setCustomBg(await fileToDataUrl(file, { maxDim: 2048, type: "image/jpeg", quality: 0.9 }));
      setBackdropTouched(true);
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
    // Compared inline (not via STATIC_BUILD) so bundlers drop the unused branch.
    if (process.env.NEXT_PUBLIC_STATIC_BUILD === "1") {
      // Inside a claude.ai artifact the page can't download directly; the viewer's
      // downloads capability asks the user to confirm the save instead.
      const downloads = await window.claude?.use?.("downloads").catch(() => null);
      if (!downloads) return void openImage();
      try {
        await downloads.save({ filename: fileName(), data: blob });
      } catch (e) {
        const code = (e as { code?: string }).code;
        if (code !== "declined" && code !== "rate_limited") openImage();
      }
    } else {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName();
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
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

  /** Shows the finished poster as an image the user can press-and-hold or right-click to save. */
  async function openImage() {
    const blob = await toBlob();
    if (!blob) return;
    setCopied(false);
    setExportUrl(URL.createObjectURL(blob));
  }

  async function copyImage() {
    try {
      const blob = await toBlob();
      if (!blob) return;
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
    } catch {
      setNotice("This browser can't copy images. Press and hold the image (or right-click it) and choose Save.");
    }
  }

  function closeImage() {
    if (exportUrl) URL.revokeObjectURL(exportUrl);
    setExportUrl(null);
  }

  // ---------- derived ----------
  const aiEngines = engines.free || engines.premium;
  const usingAiScene = engine === "premium";
  const hybrid = engine !== "premium";
  const effectivePhoto = photo ?? EXAMPLE_PRODUCT;
  const sceneEntry =
    engine === "premium" ? (scenes[format] ?? Object.values(scenes)[0] ?? null) : engine === "free" ? freeBg : customBg ? { url: customBg, side: textSide } : null;
  const backdrop = engine === "local" && !customBg ? backdropId : null;
  const cutoutUrl = !hybrid ? null : photo ? (cutout?.photo === photo ? cutout.url : null) : EXAMPLE_PRODUCT;
  const sceneForOtherSize = usingAiScene && !!sceneEntry && !scenes[format];
  const sceneSideMismatch = usingAiScene && !!scenes[format] && scenes[format]!.side !== textSide;
  const busy = busyScene || busyCopy || cutting;
  const busyLabel = cutting ? "Cutting out your product…" : busyScene ? sceneStatus : "Writing your ad copy…";

  function changeLang(l: Lang) {
    setLang(l);
    // Dhivehi reads right-to-left, so default its text block to the right side.
    if (!usingAiScene || !sceneEntry) setTextSide(l === "dv" ? "right" : "left");
  }

  const exportButtons = STATIC_BUILD ? (
    <>
      <button type="button" onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-bold text-white hover:bg-brand-900">
        <Download className="size-5" /> Save image
      </button>
      <button type="button" onClick={openImage} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-bold shadow-sm ring-1 ring-black/10">
        <Copy className="size-5" /> Copy or view
      </button>
    </>
  ) : (
    <>
      <button type="button" onClick={download} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-bold text-white hover:bg-brand-900">
        <Download className="size-5" /> Download PNG
      </button>
      {canShare && (
        <button type="button" onClick={share} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold shadow-sm ring-1 ring-black/10">
          <Share2 className="size-5" /> Share
        </button>
      )}
    </>
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-28 pt-4 sm:pb-10">
      {/* Top bar */}
      <header className="mb-4 flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-brand-700 text-white">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
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
              photoUrl={usingAiScene ? photo : effectivePhoto}
              cutoutUrl={cutoutUrl}
              hybrid={hybrid}
              backdrop={backdrop}
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
                <p className="text-sm font-semibold text-brand-900">{busyLabel}</p>
              </div>
            )}
            {improving && !busy && (
              <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                <Spinner className="size-3" /> Improving cut-out…
              </div>
            )}
            {!photo && !busy && (
              <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                Example product · add your own photo
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

          <div className="mx-auto mt-4 hidden max-w-xl gap-3 sm:flex">{exportButtons}</div>
        </div>

        {/* Controls */}
        <div className="min-w-0 space-y-4">
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
                  <TextInput id="access-code" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Access code" className="bg-white" />
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
                  <PhotoButton id="photo-retake" capture onFile={onPhoto} small>
                    <Camera className="size-4" /> Retake
                  </PhotoButton>
                  <PhotoButton id="photo-change" onFile={onPhoto} small>
                    <ImageUp className="size-4" /> Change
                  </PhotoButton>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <PhotoButton id="photo-camera" capture onFile={onPhoto}>
                  <Camera className="size-7" /> Take photo
                </PhotoButton>
                <PhotoButton id="photo-gallery" onFile={onPhoto}>
                  <ImageUp className="size-7" /> From gallery
                </PhotoButton>
              </div>
            )}
            <div className="mt-3">
              <Toggle
                checked={bestCutout}
                onChange={(v) => {
                  setBestCutout(v);
                  try {
                    window.localStorage.setItem("isthihaaru.bestCutout", v ? "1" : "0");
                  } catch {
                    /* storage unavailable */
                  }
                  if (v && photo && engine !== "premium") void cutOut(photo, true);
                }}
                label={
                  <span>
                    <span className="font-semibold">Best-quality cut-out</span>
                    <span className="block text-xs text-neutral-500">Cleaner edges. Downloads 46 MB once, then takes 10–30 s per photo.</span>
                  </span>
                }
              />
            </div>
            <p className="mt-2 text-xs text-neutral-500">The background is removed on your phone. Nothing is uploaded.</p>
          </Section>

          <Section step={2} title="Scene & size">
            {aiEngines && (
              <div className="mb-3">
                <Segmented
                  value={engine}
                  onChange={(v) => {
                    setEngine(v);
                    setNotice(null);
                    if (v !== "premium" && photo) void cutOut(photo);
                  }}
                  options={[
                    { value: "local" as SceneEngine, label: "Built-in" },
                    ...(engines.free ? [{ value: "free" as SceneEngine, label: "AI background" }] : []),
                    ...(engines.premium ? [{ value: "premium" as SceneEngine, label: "AI scene" }] : []),
                  ]}
                />
              </div>
            )}

            {engine === "local" ? (
              <BackdropPicker
                selected={customBg ? "custom" : backdropId}
                customBg={customBg}
                profile={profile}
                left={textSide === "left"}
                onSelect={(id) => {
                  setBackdropId(id);
                  setCustomBg(null);
                  setBackdropTouched(true);
                }}
                onCustom={onCustomBg}
              />
            ) : (
              <>
                <p className="mb-2 text-xs text-neutral-500">
                  {engine === "free"
                    ? "Your product is cut out on this device and placed on an AI-made background."
                    : "AI re-renders the whole photo with matching light and reflections."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SCENE_PRESETS.map((p) => (
                    <Chip key={p.id} active={presetId === p.id && !customScene.trim()} onClick={() => (setPresetId(p.id), setCustomScene(""))}>
                      <span className="mr-1">{p.emoji}</span>
                      {p.label}
                    </Chip>
                  ))}
                </div>
                <div className="mt-3">
                  <TextInput id="custom-scene" value={customScene} onChange={(e) => setCustomScene(e.target.value)} placeholder="Or describe a scene: on a wooden table with coconuts…" />
                </div>
              </>
            )}

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

            {engine !== "local" && (
              <button
                type="button"
                disabled={!photo || busy}
                onClick={createAi}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3.5 text-base font-bold text-white shadow-lg shadow-brand-700/20 transition hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Spinner className="size-5" /> : <Wand2 className="size-5" />}
                {sceneEntry ? "Make another" : "Create with AI"}
              </button>
            )}
          </Section>

          <Section
            step={3}
            title="Text"
            right={
              engines.premium ? (
                <button
                  type="button"
                  disabled={!photo || busyCopy}
                  onClick={() => void makeCopy()}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-40"
                >
                  {busyCopy ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />} Write with AI
                </button>
              ) : undefined
            }
          >
            <div className="mb-3">
              <span className="mb-1.5 block text-xs font-semibold text-neutral-600">What are you selling?</span>
              <div className="flex flex-wrap gap-1.5">
                {COPY_CATEGORIES.map((c) => (
                  <Chip key={c.id} active={category === c.id} onClick={() => chooseCategory(c.id)} className="px-2.5 py-1 text-xs">
                    {lang === "dv" ? <span className="thaana">{c.label.dv}</span> : c.label.en}
                  </Chip>
                ))}
              </div>
              <button type="button" onClick={shuffleText} className="mt-2 flex items-center gap-1 text-xs font-semibold text-brand-700">
                <Shuffle className="size-3.5" /> Try other wording
              </button>
            </div>
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
            {engines.premium && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-brand-700">Notes for the AI (optional)</summary>
                <div className="mt-2 space-y-2">
                  <TextInput id="ai-product-name" value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="Product name, e.g. Shark Energy Drink 250ml" />
                  <TextArea id="ai-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="e.g. New stock, best served cold" />
                </div>
              </details>
            )}

            <div className="mt-4 rounded-xl bg-neutral-50 p-3">
              <Toggle checked={price.show} onChange={(v) => setPrice((p) => ({ ...p, show: v }))} label={<span className="font-semibold">Show price badge</span>} />
              {price.show && (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Field label="Currency">
                    <TextInput id="price-currency" value={price.currency} onChange={(e) => setPrice((p) => ({ ...p, currency: e.target.value }))} />
                  </Field>
                  <Field label="Price">
                    <TextInput id="price-now" inputMode="decimal" value={price.price} onChange={(e) => setPrice((p) => ({ ...p, price: e.target.value }))} placeholder="15" />
                  </Field>
                  <Field label="Old price">
                    <TextInput id="price-old" inputMode="decimal" value={price.oldPrice} onChange={(e) => setPrice((p) => ({ ...p, oldPrice: e.target.value }))} placeholder="20" />
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
              {hybrid && (
                <div className="space-y-3 rounded-xl bg-neutral-50 p-3">
                  <Field label="Product size">
                    <input
                      id="product-size"
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
                      id="product-height"
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
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-black/5 bg-white/95 px-4 pt-3 backdrop-blur sm:hidden"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {exportButtons}
      </div>

      {exportUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Save your poster">
          <div className="flex max-h-full w-full max-w-lg flex-col gap-3 rounded-2xl bg-white p-4">
            <div className="flex items-center gap-2">
              <p className="flex-1 text-sm font-semibold">Press and hold the image (or right-click it) and choose Save.</p>
              <button type="button" onClick={closeImage} className="rounded-full p-2 hover:bg-neutral-100" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={exportUrl} alt="Your finished poster" className="min-h-0 w-full flex-1 rounded-xl object-contain" />
            <button type="button" onClick={copyImage} className="flex items-center justify-center gap-2 rounded-xl bg-neutral-100 py-2.5 text-sm font-semibold hover:bg-neutral-200">
              <Copy className="size-4" /> {copied ? "Copied. Paste it into Viber, WhatsApp or Instagram" : "Copy image"}
            </button>
          </div>
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
  id,
  capture,
  onFile,
  children,
  small,
}: {
  id: string;
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
        id={id}
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

