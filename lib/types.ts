export type Lang = "en" | "dv";
export type FormatId = "square" | "portrait" | "story" | "landscape";
export type TextSide = "left" | "right";
export type ThemeMode = "auto" | "dark" | "light";

export const ICON_KEYS = [
  "zap",
  "target",
  "run",
  "leaf",
  "shield",
  "star",
  "heart",
  "droplet",
  "clock",
  "truck",
  "award",
  "sparkles",
  "check",
  "flame",
  "snowflake",
  "sun",
  "gift",
  "thumbsUp",
  "smile",
  "package",
  "battery",
  "dumbbell",
  "brain",
  "apple",
  "coffee",
  "baby",
  "gem",
  "wrench",
  "tag",
  "percent",
  "recycle",
  "wheat",
  "heartPulse",
  "shirt",
  "feather",
] as const;
export type IconKey = (typeof ICON_KEYS)[number];

export interface Feature {
  icon: IconKey;
  text: string;
}

export interface AdCopy {
  category: string;
  name: string;
  subtitle: string;
  tagline: string;
  features: Feature[];
}

export interface BusinessProfile {
  name: string;
  slogan: string;
  nameDv: string;
  sloganDv: string;
  /** PNG/JPEG data URL, resized */
  logo: string | null;
  /** true when the logo image already contains the business name */
  logoHasName: boolean;
  primaryColor: string;
  accentColor: string;
  phone: string;
  whatsapp: string;
  viber: string;
  address: string;
  island: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  website: string;
  topTagline: string;
  topTaglineDv: string;
  footerTagline: string;
  footerTaglineDv: string;
  show: ContactVisibility;
}

export interface ContactVisibility {
  phone: boolean;
  whatsapp: boolean;
  viber: boolean;
  address: boolean;
  instagram: boolean;
  facebook: boolean;
  tiktok: boolean;
  website: boolean;
}

export interface PriceInfo {
  show: boolean;
  currency: string;
  price: string;
  oldPrice: string;
}

export interface CopyResponse {
  en: AdCopy;
  dv: AdCopy;
  /** English description of an empty set that suits the product (used by the free scene engine) */
  sceneIdea?: string;
}

export type SceneEngine = "free" | "premium";
