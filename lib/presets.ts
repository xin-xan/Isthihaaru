export interface ScenePreset {
  id: string;
  label: string;
  emoji: string;
  /** Scene description handed to the image model */
  scene: string;
}

export const SCENE_PRESETS: ScenePreset[] = [
  {
    id: "auto",
    label: "Auto",
    emoji: "✨",
    scene:
      "a setting that naturally suits this specific product, choosing the surface, props, colours and mood a premium brand would use in its own advertising for it",
  },
  {
    id: "natural",
    label: "Natural light",
    emoji: "🌿",
    scene:
      "a bright, airy scene with a warm cream wall, a natural stone pedestal on a light marble table, soft sunlight casting gentle leaf shadows, blurred green tropical plant leaves in the foreground corners",
  },
  {
    id: "studio",
    label: "Studio",
    emoji: "📸",
    scene:
      "a clean seamless studio backdrop in a soft neutral tone that complements the product colours, a minimal round podium, soft diffused key light and a subtle gradient",
  },
  {
    id: "luxury",
    label: "Luxury",
    emoji: "💎",
    scene:
      "a dark, moody premium scene with black marble, subtle gold accents, dramatic rim lighting and elegant reflections",
  },
  {
    id: "beach",
    label: "Beach",
    emoji: "🏝️",
    scene:
      "a sunny Maldivian beach: white sand, turquoise lagoon softly blurred in the background, palm leaf shadows, bright tropical daylight",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    emoji: "🍳",
    scene:
      "a bright modern kitchen counter with a few fresh ingredients arranged tastefully at the edges, morning window light",
  },
  {
    id: "chilled",
    label: "Ice cold",
    emoji: "🧊",
    scene:
      "a refreshing ice-cold scene with crushed ice, scattered ice cubes, water droplets and splashes, cool lighting",
  },
  {
    id: "beauty",
    label: "Beauty",
    emoji: "🌸",
    scene:
      "a soft pastel beauty scene with silk fabric, water ripples and a few flower petals, gentle glowing light",
  },
  {
    id: "festive",
    label: "Ramadan / Eid",
    emoji: "🌙",
    scene:
      "a festive Ramadan and Eid scene with ornate lanterns, a crescent motif, dates and warm golden bokeh lights",
  },
];

export function findPreset(id: string): ScenePreset {
  return SCENE_PRESETS.find((p) => p.id === id) ?? SCENE_PRESETS[0];
}
