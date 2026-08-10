import { cookies } from "next/headers";
import type { UserRole } from "@/shared/types";
import { getAdminAuth, getAdminFirestore } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/auth/constants";

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  roles: UserRole[];
  suspended?: boolean;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const raw = store.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    const decoded = await getAdminAuth().verifySessionCookie(raw, true);
    // Firestore is source of truth for roles (session cookie claims can lag after promote/seed).
    const snap = await getAdminFirestore().collection("users").doc(decoded.uid).get();
    const data = snap.data();
    const firestoreRoles = data?.roles as UserRole[] | undefined;
    const claimRoles = decoded.roles as UserRole[] | undefined;
    const roles: UserRole[] = firestoreRoles?.length
      ? firestoreRoles
      : claimRoles?.length
        ? claimRoles
        : ["candidate"];
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName: (decoded.name as string) ?? decoded.email ?? "User",
      photoURL: decoded.picture as string | undefined,
      roles,
      suspended: data?.suspended === true,
    };
  } catch {
    return null;
  }
}

export function hasRole(user: SessionUser | null, role: UserRole): boolean {
  return Boolean(user?.roles.includes(role));
}
