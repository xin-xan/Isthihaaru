import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { generateBackground } from "@/lib/cloudflare";
import { ApiError, checkAccess } from "@/lib/gemini";
import { FORMATS } from "@/lib/formats";
import type { FormatId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    checkAccess(req);
    const body = await req.json().catch(() => ({}));
    if (!FORMATS[body.format as FormatId]) throw new ApiError(400, "Unknown post size.");
    const result = await generateBackground({
      format: body.format as FormatId,
      presetId: String(body.presetId ?? "auto"),
      customScene: String(body.customScene ?? "").slice(0, 400),
      sceneIdea: String(body.sceneIdea ?? "").slice(0, 400),
      textSide: body.textSide === "right" ? "right" : "left",
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
