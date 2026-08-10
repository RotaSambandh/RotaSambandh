import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Canary: no firebase-admin. Must stay 200 if the Next runtime is healthy. */
export async function GET() {
  return NextResponse.json({ ok: true, service: "rotasambandh" });
}
