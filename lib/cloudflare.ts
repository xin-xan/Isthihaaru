import "server-only";
import { ApiError } from "./gemini";
import { findPreset } from "./presets";
import type { FormatId, TextSide } from "./types";

const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const MODEL = process.env.CLOUDFLARE_IMAGE_MODEL || "@cf/black-forest-labs/flux-1-schnell";

export const freeEngineConfigured = () => !!(ACCOUNT_ID && API_TOKEN);

export interface BackgroundRequest {
  format: FormatId;
  presetId: string;
  customScene: string;
  sceneIdea: string;
  textSide: TextSide;
}

/** Prompt for an empty "background plate"; the real product cut-out is placed on it in the browser. */
export function buildBackgroundPrompt(r: BackgroundRequest): string {
  const productSide = r.textSide === "left" ? "right" : "left";
  const scene = r.customScene.trim()
    ? r.customScene.trim()
    : r.presetId === "auto" && r.sceneIdea.trim()
      ? r.sceneIdea.trim()
      : findPreset(r.presetId).scene;
  const layout =
    r.format === "story"
      ? `Vertical composition: a wide, clean, empty surface across the bottom third of the frame, slightly towards the ${productSide}. The upper half is calm, soft and out of focus.`
      : `A wide, clean, empty surface across the lower third of the frame, with its empty centre on the ${productSide} side. The ${r.textSide} side and the top are calm, soft and slightly out of focus.`;
  return [
    "Professional product-photography background plate, photorealistic, eye-level camera.",
    `Setting: ${scene}.`,
    layout,
    "The set is completely EMPTY and waiting for a product: no product, bottle, can, jar, box, package, person, hand, text, letters, logo or watermark anywhere.",
    "Soft natural light, gentle realistic shadows, shallow depth of field, high-end commercial advertising look.",
  ].join(" ");
}

export async function generateBackground(r: BackgroundRequest): Promise<{ dataUrl: string }> {
  if (!freeEngineConfigured()) {
    throw new ApiError(500, "Free mode isn't set up. Add CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN to the server environment.");
  }
  const prompt = buildBackgroundPrompt(r).slice(0, 2000);
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/run/${MODEL}`;
  const call = (body: Record<string, unknown>) =>
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(50_000),
    });

  let res: Response;
  try {
    res = await call({ prompt, num_steps: 6 });
    // Older revisions of the model schema name the field `steps`.
    if (res.status === 400) res = await call({ prompt, steps: 6 });
  } catch (err) {
    console.error("Cloudflare request failed:", err);
    throw new ApiError(502, "The free image service didn't respond. Please try again.");
  }

  const data = (await res.json().catch(() => null)) as {
    success?: boolean;
    result?: { image?: string };
    errors?: { code?: number; message?: string }[];
  } | null;
  if (!res.ok || !data?.result?.image) {
    const msg = data?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    console.error("Cloudflare error:", msg);
    if (res.status === 401 || res.status === 403) throw new ApiError(500, "The Cloudflare API token is invalid or lacks Workers AI permission.");
    if (res.status === 429 || /neuron|limit|quota/i.test(msg)) {
      throw new ApiError(429, "Today's free image allowance is used up. It resets at midnight UTC.");
    }
    throw new ApiError(502, "The free image service failed. Please try again.");
  }
  return { dataUrl: `data:image/jpeg;base64,${data.result.image}` };
}
