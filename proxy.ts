import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { isAdminAuthPath, isEmployerAuthPath, signInPathForProtectedPath } from "@/lib/auth/portal";

const PROTECTED_PREFIXES = ["/jobs", "/companies", "/employer", "/admin", "/candidate"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public portal auth pages (no session required).
  if (isEmployerAuthPath(pathname) || isAdminAuthPath(pathname)) {
    return NextResponse.next();
  }

  const needsAuth = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (!needsAuth) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = signInPathForProtectedPath(pathname);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/jobs",
    "/jobs/:path*",
    "/companies",
    "/companies/:path*",
    "/employer",
    "/employer/:path*",
    "/admin",
    "/admin/:path*",
    "/candidate",
    "/candidate/:path*",
  ],
};
