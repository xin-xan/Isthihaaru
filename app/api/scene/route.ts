import { NextResponse } from "next/server";
import { ApiError, checkAccess, generateScene, parseImage } from "@/lib/gemini";
import { errorResponse } from "@/lib/api";
import { FORMATS } from "@/lib/formats";
import type { FormatId } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    checkAccess(req);
    const body = await req.json().catch(() => ({}));
    const format = FORMATS[body.format as FormatId];
    if (!format) throw new ApiError(400, "Unknown post size.");
    const result = await generateScene({
      image: parseImage(body.image),
      format: format.id,
      aspectRatio: format.aspectRatio,
      presetId: String(body.presetId ?? "auto"),
      customScene: String(body.customScene ?? "").slice(0, 400),
      textSide: body.textSide === "right" ? "right" : "left",
      productName: String(body.productName ?? "").slice(0, 80),
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
