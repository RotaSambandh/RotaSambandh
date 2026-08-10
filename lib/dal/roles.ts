import { getClientAuth, isFirebaseConfigured } from "@/lib/firebase/client";
import type { UserRole } from "@/shared/types";

/** Client helper: grant employer role via Admin API (Firestore rules block self role edits). */
export async function ensureEmployerRoleClient(): Promise<UserRole[]> {
  if (!isFirebaseConfigured()) {
    return ["employer", "candidate"];
  }
  const user = getClientAuth().currentUser;
  if (!user) {
    throw new Error("Not signed in");
  }
  const idToken = await user.getIdToken();
  const res = await fetch("/api/auth/ensure-employer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    throw new Error("Unable to enable employer access");
  }
  const data = (await res.json()) as { roles?: UserRole[] };
  const freshToken = await user.getIdToken(true);
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: freshToken }),
  });
  return data.roles ?? ["employer", "candidate"];
}
