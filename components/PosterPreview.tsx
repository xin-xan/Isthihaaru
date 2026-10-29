"use client";

import { useCallback, useEffect, useMemo, useState, type Ref } from "react";
import { FORMATS } from "@/lib/formats";
import { loadImage } from "@/lib/image";
import { renderPoster, textAreaLuminance, type PosterInput } from "@/lib/poster/render";
import type { ThemeMode } from "@/lib/types";

type Props = Omit<PosterInput, "width" | "height" | "scene" | "productPhoto" | "logo" | "cutout" | "theme"> & {
  sceneUrl: string | null;
  photoUrl: string | null;
  cutoutUrl: string | null;
  themeMode: ThemeMode;
  /** bump to re-render once web fonts finish loading */
  fontsVersion: number;
  canvasRef: Ref<HTMLCanvasElement>;
  onResolvedTheme?: (theme: "dark" | "light") => void;
};

function useImage(src: string | null) {
  const [img, setImg] = useState<{ src: string; el: HTMLImageElement } | null>(null);
  useEffect(() => {
    if (!src) return;
    let alive = true;
    loadImage(src)
      .then((el) => alive && setImg({ src, el }))
      .catch(() => alive && setImg(null));
    return () => {
      alive = false;
    };
  }, [src]);
  return src && img?.src === src ? img.el : null;
}

export default function PosterPreview(props: Props) {
  const { sceneUrl, photoUrl, cutoutUrl, themeMode, fontsVersion, canvasRef, onResolvedTheme, ...rest } = props;
  const scene = useImage(sceneUrl);
  const photo = useImage(photoUrl);
  const cutout = useImage(cutoutUrl);
  const logo = useImage(rest.profile.logo);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const fmt = FORMATS[rest.format];
  const attachCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      setCanvas(el);
      if (typeof canvasRef === "function") canvasRef(el);
      else if (canvasRef) canvasRef.current = el;
    },
    [canvasRef],
  );

  const luminance = useMemo(
    () => (scene ? textAreaLuminance(scene, rest.format, rest.textSide, fmt.width, fmt.height) : 1),
    [scene, rest.format, rest.textSide, fmt],
  );
  const theme: "dark" | "light" = themeMode !== "auto" ? themeMode : luminance < 0.48 ? "light" : "dark";

  useEffect(() => {
    onResolvedTheme?.(theme);
  }, [theme, onResolvedTheme]);

  useEffect(() => {
    if (!canvas) return;
    renderPoster(canvas, { ...rest, width: fmt.width, height: fmt.height, scene, productPhoto: photo, logo, cutout, theme });
    // `rest` is rebuilt every render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, scene, photo, logo, cutout, theme, fmt, fontsVersion, JSON.stringify(rest)]);

  return (
    <canvas
      ref={attachCanvas}
      className="block h-auto w-full rounded-2xl bg-neutral-200 shadow-lg ring-1 ring-black/5"
      style={{ aspectRatio: `${fmt.width} / ${fmt.height}` }}
    />
  );
}
