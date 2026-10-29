import { NextResponse } from "next/server";
import { checkAccess, generateCopy, parseImage } from "@/lib/gemini";
import { errorResponse } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    checkAccess(req);
    const body = await req.json().catch(() => ({}));
    const result = await generateCopy({
      image: parseImage(body.image),
      productName: String(body.productName ?? "").slice(0, 80),
      details: String(body.details ?? "").slice(0, 500),
      businessName: String(body.businessName ?? "").slice(0, 80),
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
