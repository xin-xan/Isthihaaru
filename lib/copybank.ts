import type { AdCopy, CopyResponse, IconKey } from "./types";

/**
 * Ready-made ad copy per product category, used when no AI text service is configured.
 * Dhivehi lines are short and plain so they read naturally on a poster; users can edit everything.
 */

interface Line {
  en: string;
  dv: string;
}

interface FeatureLine extends Line {
  icon: IconKey;
}

export interface CopyCategory {
  id: string;
  label: Line;
  /** suggested built-in background */
  backdrop: string;
  subtitles: Line[];
  taglines: Line[];
  features: FeatureLine[];
}

export const COPY_CATEGORIES: CopyCategory[] = [
  {
    id: "drinks",
    label: { en: "Drinks", dv: "ބުއިން" },
    backdrop: "chilled",
    subtitles: [
      { en: "Refreshing Drink", dv: "ތާޒާ ބުއިމެއް" },
      { en: "Cool & Refreshing", dv: "ފިނި އަދި ތާޒާ" },
    ],
    taglines: [
      { en: "Refresh\nYour Day", dv: "ދުވަސް\nތާޒާކޮށްލާ" },
      { en: "Ice Cold.\nPure Taste.", dv: "ފިނިފިނި.\nމީރު ރަހަ." },
      { en: "Taste the\nFreshness", dv: "ތާޒާކަމުގެ\nރަހަ ބަލާ" },
    ],
    features: [
      { icon: "snowflake", en: "Best Served Chilled", dv: "ފިނިކޮށް ބޯލަން" },
      { icon: "zap", en: "Instant Refreshment", dv: "އަވަސް ތާޒާކަމެއް" },
      { icon: "droplet", en: "Quenches Thirst", dv: "ކަރުހިއްކުން ފިލުވާ" },
      { icon: "heart", en: "Great Taste", dv: "މީރު ރަހަ" },
      { icon: "star", en: "Top Quality", dv: "އެންމެ ރަނގަޅު ކޮލިޓީ" },
      { icon: "tag", en: "Great Value", dv: "އަގުހެޔޮ" },
    ],
  },
  {
    id: "food",
    label: { en: "Food & Snacks", dv: "ކާނާ" },
    backdrop: "wood",
    subtitles: [
      { en: "Tasty Snack", dv: "މީރު ސްނޭކް" },
      { en: "Delicious Treat", dv: "މީރު ކާނާ" },
    ],
    taglines: [
      { en: "Taste You'll\nLove", dv: "ލޯބިވާނެ\nރަހައެއް" },
      { en: "Snack Time,\nAnytime", dv: "ކޮންމެ ވަގުތަކު\nކައިލެވޭ" },
      { en: "Made to\nBe Shared", dv: "ހިއްސާކުރަން\nހެދިފައި" },
    ],
    features: [
      { icon: "heart", en: "Delicious Taste", dv: "މީރު ރަހަ" },
      { icon: "smile", en: "Loved by All Ages", dv: "ހުރިހާ އުމުރަކަށް" },
      { icon: "package", en: "Easy to Carry", dv: "ގެންގުޅެން ފަސޭހަ" },
      { icon: "star", en: "Premium Quality", dv: "އިސް ފެންވަރު" },
      { icon: "gift", en: "Perfect to Share", dv: "ހިއްސާކުރަން ރަނގަޅު" },
      { icon: "tag", en: "Great Value", dv: "އަގުހެޔޮ" },
    ],
  },
  {
    id: "grocery",
    label: { en: "Groceries", dv: "ގްރޮސަރީ" },
    backdrop: "natural",
    subtitles: [
      { en: "Fresh Stock", dv: "އާ ސްޓޮކް" },
      { en: "Everyday Essentials", dv: "ކޮންމެ ދުވަހަކު ބޭނުންވާ" },
    ],
    taglines: [
      { en: "Quality You\nCan Trust", dv: "އިތުބާރުކުރެވޭ\nކޮލިޓީ" },
      { en: "Fresh Stock\nJust Arrived", dv: "އާ ސްޓޮކް\nއައިސްފި" },
      { en: "Good Food,\nGood Life", dv: "ރަނގަޅު ކާނާ،\nރަނގަޅު ދިރިއުޅުން" },
    ],
    features: [
      { icon: "leaf", en: "Fresh & Natural", dv: "ތާޒާ އަދި ޤުދުރަތީ" },
      { icon: "tag", en: "Best Price", dv: "އެންމެ ހެޔޮ އަގު" },
      { icon: "truck", en: "Home Delivery", dv: "ގެއަށް ޑެލިވަރީ" },
      { icon: "check", en: "Quality Checked", dv: "ކޮލިޓީ ޗެކްކޮށްފައި" },
      { icon: "package", en: "Family Pack", dv: "ފެމިލީ ޕެކް" },
      { icon: "wheat", en: "Wholesome", dv: "ފައިދާހުރި" },
    ],
  },
  {
    id: "beauty",
    label: { en: "Beauty & Skincare", dv: "ބިއުޓީ" },
    backdrop: "pastel",
    subtitles: [
      { en: "Beauty Care", dv: "ބިއުޓީ ކެއަރ" },
      { en: "Skin Care", dv: "ހަމުގެ ބެލުން" },
    ],
    taglines: [
      { en: "Glow\nEvery Day", dv: "ކޮންމެ ދުވަހަކު\nވިދާލާ" },
      { en: "Beauty in\nEvery Drop", dv: "ކޮންމެ ތިއްކެއްގައި\nރީތިކަން" },
      { en: "Care Your Skin\nDeserves", dv: "ހަމަށް ޙައްޤު\nސަމާލުކަން" },
    ],
    features: [
      { icon: "sparkles", en: "Radiant Glow", dv: "ހަން ވިދާލާ" },
      { icon: "droplet", en: "Deep Moisture", dv: "ހަން ތެތްކޮށް ބަހައްޓާ" },
      { icon: "leaf", en: "Gentle Formula", dv: "ހަމަށް ލުއި" },
      { icon: "feather", en: "Soft & Smooth", dv: "ފުށް އަދި ހިމަ" },
      { icon: "shield", en: "Daily Protection", dv: "ދުވަހުން ދުވަހަށް ރައްކާތެރިކަން" },
      { icon: "star", en: "Premium Quality", dv: "އިސް ފެންވަރު" },
    ],
  },
  {
    id: "perfume",
    label: { en: "Perfume", dv: "އަތަރު" },
    backdrop: "luxury",
    subtitles: [
      { en: "Signature Fragrance", dv: "ހާއްސަ ވަސް" },
      { en: "Eau de Parfum", dv: "އަތަރު" },
    ],
    taglines: [
      { en: "Leave a Lasting\nImpression", dv: "ހަނދާނުގައި\nދެމިހުންނަ ވަހެއް" },
      { en: "Elegance in\nEvery Spray", dv: "ކޮންމެ ސްޕްރޭއެއްގައި\nރީތިކަން" },
    ],
    features: [
      { icon: "clock", en: "Long Lasting", dv: "ގިނައިރު ދެމިހުރޭ" },
      { icon: "gem", en: "Luxury Scent", dv: "ލަގްޒަރީ ވަސް" },
      { icon: "gift", en: "Perfect Gift", dv: "ހަދިޔާއަކަށް ރަނގަޅު" },
      { icon: "sparkles", en: "Fresh Notes", dv: "ތާޒާ ވަސް" },
      { icon: "star", en: "Premium Quality", dv: "އިސް ފެންވަރު" },
      { icon: "heart", en: "Signature Style", dv: "ހާއްސަ ސްޓައިލް" },
    ],
  },
  {
    id: "electronics",
    label: { en: "Electronics", dv: "އިލެކްޓްރޯނިކްސް" },
    backdrop: "studio",
    subtitles: [
      { en: "Smart Choice", dv: "ސްމާޓް އިޚްތިޔާރެއް" },
      { en: "Latest Model", dv: "އެންމެ އާ މޮޑެލް" },
    ],
    taglines: [
      { en: "Smart Tech,\nBetter Life", dv: "ސްމާޓް ޓެކް،\nރަނގަޅު ދިރިއުޅުން" },
      { en: "Power in\nYour Hands", dv: "ބާރު\nތިބާގެ އަތްދަށުގައި" },
    ],
    features: [
      { icon: "battery", en: "Long Battery Life", dv: "ގިނައިރު ބެޓަރީ" },
      { icon: "zap", en: "Fast Performance", dv: "އަވަސް ޕާފޯމަންސް" },
      { icon: "shield", en: "Reliable Build", dv: "ބަރޯސާވެވޭ" },
      { icon: "wrench", en: "Easy Setup", dv: "ސެޓަޕްކުރަން ފަސޭހަ" },
      { icon: "star", en: "Trusted Brand", dv: "އިތުބާރުކުރެވޭ ބްރޭންޑް" },
      { icon: "truck", en: "Fast Delivery", dv: "އަވަސް ޑެލިވަރީ" },
    ],
  },
  {
    id: "fashion",
    label: { en: "Fashion", dv: "ފެޝަން" },
    backdrop: "minimal",
    subtitles: [
      { en: "New Collection", dv: "އާ ކަލެކްޝަން" },
      { en: "New Arrival", dv: "އާ ބާވަތް" },
    ],
    taglines: [
      { en: "Style That\nSpeaks", dv: "ވާހަކަ ދައްކާ\nސްޓައިލް" },
      { en: "New Season,\nNew You", dv: "އާ ސީޒަން،\nއާ ތިބާ" },
    ],
    features: [
      { icon: "shirt", en: "Comfortable Fit", dv: "ލައިގެން އަރާމު" },
      { icon: "sparkles", en: "Trendy Design", dv: "ޒަމާނީ ޑިޒައިން" },
      { icon: "feather", en: "Lightweight", dv: "ލުއި" },
      { icon: "star", en: "Quality Fabric", dv: "ރަނގަޅު ފޮތި" },
      { icon: "tag", en: "Affordable Price", dv: "އަގުހެޔޮ" },
      { icon: "gift", en: "Great Gift", dv: "ހަދިޔާއަކަށް ރަނގަޅު" },
    ],
  },
  {
    id: "home",
    label: { en: "Home & Cleaning", dv: "ގޭގެ ބޭނުމަށް" },
    backdrop: "brand",
    subtitles: [
      { en: "Home Care", dv: "ގޭގެ ބޭނުމަށް" },
      { en: "Household Essential", dv: "ގެއަށް ބޭނުންވާ" },
    ],
    taglines: [
      { en: "A Cleaner Home,\nMade Easy", dv: "ސާފު ގެއެއް،\nފަސޭހައިން" },
      { en: "Shine\nBright", dv: "ވިދާލާ\nސާފުކަން" },
    ],
    features: [
      { icon: "sparkles", en: "Sparkling Clean", dv: "ވިދާ ސާފުކަން" },
      { icon: "leaf", en: "Fresh Fragrance", dv: "ތާޒާ ވަސް" },
      { icon: "droplet", en: "Easy to Use", dv: "ބޭނުންކުރަން ފަސޭހަ" },
      { icon: "recycle", en: "Eco Friendly", dv: "ތިމާވެށްޓަށް ރަނގަޅު" },
      { icon: "tag", en: "Value Pack", dv: "އަގުހެޔޮ ޕެކް" },
      { icon: "check", en: "Deep Cleaning", dv: "ފުރިހަމައަށް ސާފުކުރޭ" },
    ],
  },
  {
    id: "health",
    label: { en: "Health", dv: "ސިއްޙަތު" },
    backdrop: "leafy",
    subtitles: [
      { en: "Health & Wellness", dv: "ސިއްޙަތަށް" },
      { en: "Daily Wellness", dv: "ކޮންމެ ދުވަހަކު" },
    ],
    taglines: [
      { en: "Feel\nYour Best", dv: "އެންމެ ރަނގަޅު\nޙާލުގައި" },
      { en: "A Healthy Choice\nEvery Day", dv: "ކޮންމެ ދުވަހަކު\nސިއްޙީ އިޚްތިޔާރެއް" },
    ],
    features: [
      { icon: "heartPulse", en: "Daily Wellness", dv: "ދުވަހުން ދުވަހަށް" },
      { icon: "leaf", en: "Natural Ingredients", dv: "ޤުދުރަތީ ބާވަތްތައް" },
      { icon: "zap", en: "Boosts Energy", dv: "ހަކަތަ އިތުރުކޮށްދޭ" },
      { icon: "check", en: "Quality Assured", dv: "ކޮލިޓީ ޔަޤީން" },
      { icon: "apple", en: "Healthy Living", dv: "ސިއްޙީ ދިރިއުޅުން" },
      { icon: "star", en: "Trusted Brand", dv: "އިތުބާރުކުރެވޭ ބްރޭންޑް" },
    ],
  },
  {
    id: "kids",
    label: { en: "Kids & Baby", dv: "ކުޑަކުދިން" },
    backdrop: "pastel",
    subtitles: [
      { en: "For Little Ones", dv: "ކުޑަކުދިންނަށް" },
      { en: "Baby Care", dv: "ތުއްތުކުދިންނަށް" },
    ],
    taglines: [
      { en: "Made for\nLittle Ones", dv: "ކުޑަކުދިންނަށް\nޓަކައި" },
      { en: "Happy Kids,\nHappy Home", dv: "އުފާވެރި ކުދިން،\nއުފާވެރި ގެ" },
    ],
    features: [
      { icon: "baby", en: "Gentle & Safe", dv: "ލުއި އަދި ރައްކާތެރި" },
      { icon: "smile", en: "Kids Love It", dv: "ކުދިންނަށް ކަމުދޭ" },
      { icon: "heart", en: "Made with Care", dv: "ސަމާލުކަމާއެކު" },
      { icon: "star", en: "Top Quality", dv: "އެންމެ ރަނގަޅު ކޮލިޓީ" },
      { icon: "gift", en: "Perfect Gift", dv: "ހަދިޔާއަކަށް ރަނގަޅު" },
      { icon: "tag", en: "Great Value", dv: "އަގުހެޔޮ" },
    ],
  },
  {
    id: "general",
    label: { en: "Other", dv: "އެހެނިހެން" },
    backdrop: "natural",
    subtitles: [
      { en: "New Arrival", dv: "އާ ބާވަތް" },
      { en: "Now Available", dv: "މިހާރު ލިބެން ހުރި" },
    ],
    taglines: [
      { en: "Quality You\nCan Trust", dv: "އިތުބާރުކުރެވޭ\nކޮލިޓީ" },
      { en: "Now\nAvailable", dv: "މިހާރު\nލިބެން ހުރި" },
      { en: "Don't Miss\nOut", dv: "ފުރުޞަތު\nގެއްލުވާނުލާ" },
    ],
    features: [
      { icon: "star", en: "Top Quality", dv: "އެންމެ ރަނގަޅު ކޮލިޓީ" },
      { icon: "tag", en: "Best Price", dv: "އެންމެ ހެޔޮ އަގު" },
      { icon: "truck", en: "Fast Delivery", dv: "އަވަސް ޑެލިވަރީ" },
      { icon: "check", en: "Original Product", dv: "އޯރިޖިނަލް ބާވަތް" },
      { icon: "thumbsUp", en: "Customer Favourite", dv: "ކަސްޓަމަރުންނަށް ކަމުދޭ" },
      { icon: "gift", en: "Great Gift", dv: "ހަދިޔާއަކަށް ރަނގަޅު" },
    ],
  },
];

export const findCategory = (id: string) => COPY_CATEGORIES.find((c) => c.id === id) ?? COPY_CATEGORIES[COPY_CATEGORIES.length - 1];

/** Picks a tagline, subtitle and three features; `variant` steps through the options on each shuffle. */
export function templateCopy(categoryId: string, productName: string, variant: number): CopyResponse {
  const c = findCategory(categoryId);
  const pick = <T,>(list: T[], offset = 0) => list[(variant + offset) % list.length];
  const start = (variant * 3) % c.features.length;
  const feats = [0, 1, 2].map((i) => c.features[(start + i) % c.features.length]);
  const name = productName.trim();
  // Small spaced line above the name, then a bold second line under it (as in "ENERGY DRINK / Shark / Energy Drink").
  const build = (lang: "en" | "dv"): AdCopy => ({
    category: pick(c.subtitles)[lang],
    name,
    subtitle: pick(c.subtitles, 1)[lang],
    tagline: pick(c.taglines)[lang],
    features: feats.map((f) => ({ icon: f.icon, text: f[lang] })),
  });
  return { en: build("en"), dv: build("dv") };
}
