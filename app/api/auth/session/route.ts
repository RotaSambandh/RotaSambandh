import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import type { UserRole } from "@/shared/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let idToken: string | undefined;
    try {
      const body = (await request.json()) as { idToken?: string };
      idToken = body.idToken;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    // Dynamic import: static `firebase-admin` import crashes the whole Netlify
    // function module (empty 500) when protos/node_modules are not packaged.
    // Documented exception to the no-inline-imports rule for platform packaging.
    let admin: typeof import("@/lib/firebase/admin");
    try {
      admin = await import("@/lib/firebase/admin");
    } catch (importErr) {
      const detail =
        importErr instanceof Error ? importErr.message : String(importErr);
      console.error("[auth/session] admin import failed", detail);
      return NextResponse.json(
        {
          error: "Firebase Admin failed to load on the server",
          code: "admin_import_failed",
          detail,
        },
        { status: 503 },
      );
    }

    const auth = admin.getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const userSnap = await admin
      .getAdminFirestore()
      .collection("users")
      .doc(decoded.uid)
      .get();
    const roles =
      (userSnap.data()?.roles as UserRole[] | undefined) ?? ["candidate"];

    const tokenRoles = (decoded.roles as UserRole[] | undefined) ?? [];
    const rolesMatch =
      roles.length === tokenRoles.length &&
      roles.every((r) => tokenRoles.includes(r));
    if (!rolesMatch) {
      await auth.setCustomUserClaims(decoded.uid, { roles });
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn,
    });
    const store = await cookies();
    store.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: expiresIn / 1000,
      path: "/",
    });
    return NextResponse.json({ ok: true, roles });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "";
    console.error("[auth/session]", message);
    if (name === "AdminConfigError") {
      return NextResponse.json(
        { error: message, code: "admin_not_configured" },
        { status: 503 },
      );
    }
    if (/DECODER|PEM|private key|credential/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "Firebase Admin private key is invalid. Re-paste FIREBASE_PRIVATE_KEY in Netlify (full PEM, use \\n for newlines, no wrapping quotes) and redeploy.",
          code: "admin_bad_key",
        },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: "Unable to create session", detail: message },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
