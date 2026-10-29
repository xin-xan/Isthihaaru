import { NextResponse } from "next/server";
import { freeEngineConfigured } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

/** Tells the client which scene engines the server is configured for. */
export function GET() {
  return NextResponse.json({
    premium: !!process.env.GEMINI_API_KEY,
    free: freeEngineConfigured(),
  });
}
