import type { FormatId } from "./types";

export interface Format {
  id: FormatId;
  label: string;
  hint: string;
  width: number;
  height: number;
  /** Aspect ratio requested from the image model */
  aspectRatio: string;
}

export const FORMATS: Record<FormatId, Format> = {
  square: { id: "square", label: "Square", hint: "1:1 Feed", width: 1080, height: 1080, aspectRatio: "1:1" },
  portrait: { id: "portrait", label: "Portrait", hint: "4:5 Feed", width: 1080, height: 1350, aspectRatio: "4:5" },
  story: { id: "story", label: "Story", hint: "9:16 Status", width: 1080, height: 1920, aspectRatio: "9:16" },
  landscape: { id: "landscape", label: "Landscape", hint: "16:9 Viber/FB", width: 1920, height: 1080, aspectRatio: "16:9" },
};

export const FORMAT_LIST = Object.values(FORMATS);
