import type { BusinessProfile } from "./types";

const PROFILE_KEY = "isthihaaru.profile.v1";
const ACCESS_KEY = "isthihaaru.accessCode";
const FONT_KEY = "isthihaaru.thaanaFont";

export const DEFAULT_PROFILE: BusinessProfile = {
  name: "",
  slogan: "",
  nameDv: "",
  sloganDv: "",
  logo: null,
  logoHasName: false,
  primaryColor: "#1B6B2F",
  accentColor: "#7CB342",
  phone: "",
  whatsapp: "",
  viber: "",
  address: "",
  island: "",
  instagram: "",
  facebook: "",
  tiktok: "",
  website: "",
  topTagline: "Your trusted shopping partner",
  topTaglineDv: "",
  footerTagline: "Quality Products at Great Prices",
  footerTaglineDv: "",
  show: {
    phone: true,
    whatsapp: false,
    viber: false,
    address: false,
    instagram: false,
    facebook: false,
    tiktok: false,
    website: false,
  },
};

// Storage can throw (private mode, quota, blocked site data), so every access is guarded.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): boolean {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function loadProfile(): BusinessProfile | null {
  const raw = read(PROFILE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BusinessProfile>;
    return { ...DEFAULT_PROFILE, ...parsed, show: { ...DEFAULT_PROFILE.show, ...parsed.show } };
  } catch {
    return null;
  }
}

export function saveProfile(profile: BusinessProfile): boolean {
  return write(PROFILE_KEY, JSON.stringify(profile));
}

export function loadAccessCode(): string {
  return read(ACCESS_KEY) ?? "";
}

export function saveAccessCode(code: string) {
  write(ACCESS_KEY, code || null);
}

export interface StoredFont {
  name: string;
  dataUrl: string;
}

export function loadThaanaFont(): StoredFont | null {
  const raw = read(FONT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredFont;
  } catch {
    return null;
  }
}

export function saveThaanaFont(font: StoredFont | null): boolean {
  return write(FONT_KEY, font ? JSON.stringify(font) : null);
}
