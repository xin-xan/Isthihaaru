import "server-only";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";
import { findPreset } from "./presets";
import { ICON_KEYS, type AdCopy, type CopyResponse, type FormatId, type IconKey, type TextSide } from "./types";

const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image";
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-3.5-flash";
/** Tried once when the main text model is overloaded (503). */
const TEXT_FALLBACK_MODEL = "gemini-flash-latest";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ApiError(500, "Server is missing GEMINI_API_KEY. Add it to your environment variables.");
  // Keep retries short: the SDK default (5 attempts, up to 60 s apart) outlasts serverless time limits.
  return new GoogleGenAI({ apiKey, httpOptions: { retryOptions: { attempts: 2, initialDelay: 1, maxDelay: 3 } } });
}

/** Rejects the request when APP_ACCESS_CODE is configured and the header doesn't match. */
export function checkAccess(req: Request) {
  const code = process.env.APP_ACCESS_CODE;
  if (code && req.headers.get("x-access-code") !== code) {
    throw new ApiError(401, "Enter the access code to use the generator.", "access_code_required");
  }
}

export interface ImageInput {
  /** base64 without the data: prefix */
  data: string;
  mimeType: string;
}

const MAX_IMAGE_BASE64 = 6_000_000;

export function parseImage(value: unknown): ImageInput {
  if (typeof value !== "string") throw new ApiError(400, "Missing product photo.");
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) throw new ApiError(400, "Photo must be a PNG, JPEG or WebP data URL.");
  if (match[2].length > MAX_IMAGE_BASE64) throw new ApiError(413, "Photo is too large.");
  return { mimeType: match[1], data: match[2] };
}

function compositionFor(format: FormatId, side: TextSide): string {
  const productSide = side === "left" ? "right" : "left";
  if (format === "story") {
    return (
      `Vertical 9:16 composition. Place the product in the lower half of the frame, slightly towards the ${productSide}, ` +
      `as the clear hero (about 35-45% of the frame height). Keep the entire upper half calm, softly lit and low in detail ` +
      `(soft blurred background, no props there) because headline text will be overlaid on it later. ` +
      `Keep the bottom ${side} corner simple too.`
    );
  }
  const shape = format === "landscape" ? "Wide 16:9" : format === "square" ? "Square 1:1" : "Portrait 4:5";
  return (
    `${shape} composition. Place the product in the ${productSide} half of the frame, slightly below centre, ` +
    `as the clear hero (about 45-60% of the frame height). Keep the ${side} half of the image and the top band calm, ` +
    `softly lit and low in detail (soft blurred background, no props there) because text will be overlaid on it later. ` +
    `Keep the bottom ${side} corner simple too.`
  );
}

export interface SceneRequest {
  image: ImageInput;
  format: FormatId;
  aspectRatio: string;
  presetId: string;
  customScene: string;
  textSide: TextSide;
  productName: string;
}

export function buildScenePrompt(r: Omit<SceneRequest, "image" | "aspectRatio">): string {
  const preset = findPreset(r.presetId);
  const scene = r.customScene.trim() ? `${r.customScene.trim()} (interpret this as a premium advertising set)` : preset.scene;
  const product = r.productName.trim() ? ` The product is "${r.productName.trim()}".` : "";
  return [
    "Create a photorealistic, high-end commercial advertising photograph of the product shown in the attached phone photo." + product,
    "PRODUCT FIDELITY (most important): the product must look exactly like the one in the photo - identical shape, proportions, colours, materials, label artwork, logos and printed text. Do not redesign it, rename it, simplify the label or invent new text on it.",
    "Completely remove the original background, surroundings, hands, price stickers and clutter from the photo. Straighten and correct the perspective so the product stands naturally.",
    `SCENE: ${scene}.`,
    `COMPOSITION: ${compositionFor(r.format, r.textSide)}`,
    "LIGHTING: relight the product to match the new scene with realistic contact shadows, reflections and highlights. Professional product photography, 85mm lens look, shallow depth of field, tack-sharp focus on the product, rich but natural colour grading.",
    "Do NOT add any text, letters, numbers, watermarks, logos, frames or graphic elements anywhere in the image other than what is already printed on the product itself.",
  ].join("\n\n");
}

export async function generateScene(r: SceneRequest): Promise<{ dataUrl: string }> {
  const ai = client();
  const prompt = buildScenePrompt(r);

  const run = (aspectRatio: string) =>
    ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: [{ role: "user", parts: [{ inlineData: r.image }, { text: prompt }] }],
      config: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio } },
    });

  let res;
  try {
    res = await run(r.aspectRatio);
  } catch (err) {
    // Some models don't support every ratio (e.g. 4:5); fall back to the closest common one.
    const fallback: Record<string, string> = { "4:5": "3:4" };
    const alt = fallback[r.aspectRatio];
    if (alt && /aspect/i.test(String(err))) res = await run(alt);
    else throw wrapGeminiError(err);
  }

  const candidate = res.candidates?.[0];
  for (const part of candidate?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      return { dataUrl: `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}` };
    }
  }
  const reason = candidate?.finishReason || res.promptFeedback?.blockReason;
  throw new ApiError(
    502,
    reason
      ? `The image model did not return an image (${reason}). Try another photo or scene.`
      : "The image model did not return an image. Please try again.",
  );
}

function wrapGeminiError(err: unknown): ApiError {
  if (err instanceof ApiError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (/API key/i.test(msg)) return new ApiError(500, "The Gemini API key is invalid.");
  if (/free_tier/i.test(msg) && /limit: 0\b/.test(msg)) {
    return new ApiError(
      402,
      "This Gemini model isn't available on the free tier. Enable billing for your API key's project in Google AI Studio, then try again.",
      "billing_required",
    );
  }
  if (/quota|429|RESOURCE_EXHAUSTED/i.test(msg)) return new ApiError(429, "AI usage limit reached. Please wait a moment and try again.");
  if (/no longer available|not found|404/i.test(msg) && /model/i.test(msg)) {
    console.error("Gemini model error:", msg);
    return new ApiError(502, "The configured Gemini model isn't available. Update GEMINI_IMAGE_MODEL / GEMINI_TEXT_MODEL.");
  }
  console.error("Gemini error:", msg);
  return new ApiError(502, "The AI service failed. Please try again.");
}

const copySchema = {
  type: Type.OBJECT,
  properties: {
    category: { type: Type.STRING, description: "1-3 word product category, e.g. 'Energy Drink'" },
    name: { type: Type.STRING, description: "Product or brand name as printed on the product, max 3 words" },
    subtitle: { type: Type.STRING, description: "2-4 word descriptor under the name, e.g. 'Energy Drink'" },
    tagline: { type: Type.STRING, description: "Catchy slogan, max 8 words, may contain one \\n line break" },
    features: {
      type: Type.ARRAY,
      minItems: 3,
      maxItems: 3,
      items: {
        type: Type.OBJECT,
        properties: {
          icon: { type: Type.STRING, enum: [...ICON_KEYS] },
          text: { type: Type.STRING, description: "Benefit in 2-4 words" },
        },
        required: ["icon", "text"],
        propertyOrdering: ["icon", "text"],
      },
    },
  },
  required: ["category", "name", "subtitle", "tagline", "features"],
  propertyOrdering: ["category", "name", "subtitle", "tagline", "features"],
};

export interface CopyRequest {
  image: ImageInput;
  productName: string;
  details: string;
  businessName: string;
}

export async function generateCopy(r: CopyRequest): Promise<CopyResponse> {
  const ai = client();
  const hints = [
    r.productName.trim() && `Product name given by the seller: ${r.productName.trim()}`,
    r.details.trim() && `Seller's notes about the product: ${r.details.trim()}`,
    r.businessName.trim() && `The shop selling it: ${r.businessName.trim()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `You are a senior advertising copywriter for shops in the Maldives.
Look at the product photo and write short, punchy social-media ad copy for it.
${hints}

Rules:
- Identify the product accurately from its packaging. Use the brand/product name exactly as printed.
- "subtitle" complements the name (e.g. name "Shark", subtitle "Energy Drink").
- "tagline" is a memorable 2-6 word slogan; you may split it into two short lines with \\n (e.g. "More Energy.\\nMore You.").
- Exactly 3 features: real, believable benefits of this kind of product. Pick the best matching icon for each.
- Never invent prices, discounts, medical claims or certifications.
- Write an original tagline; never reuse another brand's famous slogan.
- Return two versions:
  "en": English.
  "dv": natural, fluent Maldivian Dhivehi written in Thaana script (not Latin transliteration). Keep brand names in their original spelling. Keep the same icons.
- "sceneIdea": in English, describe an empty photo set that would flatter this product (e.g. "a wet black slate surface with crushed ice and cool blue rim light"). Do not mention the product.`;

  const run = (model: string) =>
    ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ inlineData: r.image }, { text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            en: copySchema,
            dv: copySchema,
            sceneIdea: {
              type: Type.STRING,
              description:
                "One sentence describing an empty advertising set that suits this product (surface, props, colours, light), without the product itself",
            },
          },
          required: ["en", "dv", "sceneIdea"],
          propertyOrdering: ["en", "dv", "sceneIdea"],
        },
        temperature: 0.8,
        // Short copy doesn't need deep reasoning; keeps the request well under serverless time limits.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    });

  try {
    let res;
    try {
      res = await run(TEXT_MODEL);
    } catch (err) {
      if (TEXT_MODEL === TEXT_FALLBACK_MODEL || !/503|UNAVAILABLE|overloaded/i.test(String(err))) throw err;
      res = await run(TEXT_FALLBACK_MODEL);
    }
    const parsed = JSON.parse(res.text ?? "{}") as Partial<CopyResponse>;
    return { en: sanitizeCopy(parsed.en), dv: sanitizeCopy(parsed.dv), sceneIdea: clip(parsed.sceneIdea, 300) };
  } catch (err) {
    throw wrapGeminiError(err);
  }
}

function clip(v: unknown, max: number): string {
  return typeof v === "string" ? v.replace(/\\n/g, "\n").trim().slice(0, max) : "";
}

function sanitizeCopy(c: Partial<AdCopy> | undefined): AdCopy {
  const features = Array.isArray(c?.features) ? c.features.slice(0, 3) : [];
  while (features.length < 3) features.push({ icon: "check", text: "" });
  return {
    category: clip(c?.category, 40),
    name: clip(c?.name, 40),
    subtitle: clip(c?.subtitle, 60),
    tagline: clip(c?.tagline, 90),
    features: features.map((f) => ({
      icon: (ICON_KEYS as readonly string[]).includes(f?.icon) ? (f.icon as IconKey) : "check",
      text: clip(f?.text, 40),
    })),
  };
}
