import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import {
  AdminConfigError,
  getAdminAuth,
  getAdminFirestore,
} from "@/lib/firebase/admin";
import type { UserRole } from "@/shared/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const userSnap = await getAdminFirestore()
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
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
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
    if (err instanceof AdminConfigError) {
      console.error("[auth/session]", err.message);
      return NextResponse.json(
        { error: err.message, code: "admin_not_configured" },
        { status: 503 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error("[auth/session]", message);
    // Common Netlify misconfig: mangled private key / wrong service account.
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
