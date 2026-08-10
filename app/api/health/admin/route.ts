import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Canary for Netlify firebase-admin packaging.
 * Returns JSON even on failure so Function logs / response body show the real error.
 */
export async function GET() {
  try {
    const admin = await import("@/lib/firebase/admin");
    admin.getAdminApp();
    return NextResponse.json({
      ok: true,
      admin: "loaded",
      projectId: process.env.FIREBASE_PROJECT_ID || "from-public-config",
      hasClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      hasPrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[health/admin]", detail);
    return NextResponse.json(
      { ok: false, code: "admin_load_failed", detail },
      { status: 503 },
    );
  }
}
