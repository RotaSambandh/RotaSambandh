"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { ensureUserDoc, getUser } from "@/lib/dal/users";
import type { UserRole } from "@/shared/types";

interface AuthContextValue {
  user: User | null;
  roles: UserRole[];
  loading: boolean;
  signInGoogle: () => Promise<void>;
  setRoles: (roles: UserRole[]) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncSession(user: User): Promise<UserRole[]> {
  // Ensure user + candidate profile shells exist without clobbering roles.
  const doc = await ensureUserDoc({
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email ?? "User",
    photoURL: user.photoURL ?? undefined,
  });
  // Force-refresh so ID token picks up custom claims (roles) after seed/promote.
  const idToken = await user.getIdToken(true);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (res.ok) {
    const body = (await res.json()) as { roles?: UserRole[] };
    if (body.roles?.length) return body.roles;
  }
  return doc.roles?.length ? doc.roles : ["candidate"];
}

async function rolesForUser(user: User): Promise<UserRole[]> {
  try {
    return await syncSession(user);
  } catch (err) {
    // Never invent roles that demote staff — fall back to Firestore if sync failed mid-write.
    try {
      const existing = await getUser(user.uid);
      if (existing?.roles?.length) return existing.roles;
    } catch {
      // ignore
    }
    throw err;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<UserRole[]>(["candidate"]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = getClientAuth();
    return onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (next) {
        try {
          setRoles(await rolesForUser(next));
        } catch {
          // Keep previous roles if any; default only when we have nothing better.
          setRoles((prev) => (prev.length ? prev : ["candidate"]));
        }
      } else {
        setRoles(["candidate"]);
      }
      setLoading(false);
    });
  }, []);

  const signInGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      const result = await signInWithPopup(getClientAuth(), provider);
      const nextRoles = await rolesForUser(result.user);
      setUser(result.user);
      setRoles(nextRoles);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/database is closing|closing\/hidden/i.test(message)) {
        throw new Error(
          "Google sign-in was interrupted by the browser. Close other auth popups, refresh this page, and try again.",
        );
      }
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(getClientAuth());
    await fetch("/api/auth/session", { method: "DELETE" });
  }, []);

  const value = useMemo(
    () => ({
      user,
      roles,
      loading,
      signInGoogle,
      setRoles,
      logout,
    }),
    [user, roles, loading, signInGoogle, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
