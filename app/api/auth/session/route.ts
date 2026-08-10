import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import type { UserRole } from "@/shared/types";

export async function POST(request: Request) {
  try {
    const { idToken } = (await request.json()) as { idToken?: string };
    if (!idToken) {
      return NextResponse.json({ error: "Missing idToken" }, { status: 400 });
    }

    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    const userSnap = await getAdminFirestore().collection("users").doc(decoded.uid).get();
    const roles = (userSnap.data()?.roles as UserRole[] | undefined) ?? ["candidate"];

    const tokenRoles = (decoded.roles as UserRole[] | undefined) ?? [];
    const rolesMatch =
      roles.length === tokenRoles.length && roles.every((r) => tokenRoles.includes(r));
    if (!rolesMatch) {
      await auth.setCustomUserClaims(decoded.uid, { roles });
    }

    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    // Fresh token after claims update when needed
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
  } catch {
    return NextResponse.json({ error: "Unable to create session" }, { status: 401 });
  }
}

export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
