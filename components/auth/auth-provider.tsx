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
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getClientAuth } from "@/lib/firebase/client";
import { ensureUserDoc, getUser } from "@/lib/dal/users";
import { isNativeApp } from "@/lib/native/platform";
import type { UserRole } from "@/shared/types";

interface AuthContextValue {
  user: User | null;
  roles: UserRole[];
  loading: boolean;
  signInGoogle: (opts?: {
    onProgress?: (stage: "google" | "session") => void;
  }) => Promise<void>;
  setRoles: (roles: UserRole[]) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function syncSession(user: User): Promise<UserRole[]> {
  const doc = await ensureUserDoc({
    uid: user.uid,
    email: user.email ?? "",
    displayName: user.displayName ?? user.email ?? "User",
    photoURL: user.photoURL ?? undefined,
  });
  const idToken = await user.getIdToken(true);
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string;
      code?: string;
    } | null;
    throw new Error(
      body?.error ||
        `Could not create server session (${res.status}). Check Netlify Firebase Admin secrets.`,
    );
  }
  const body = (await res.json()) as { roles?: UserRole[] };
  if (body.roles?.length) return body.roles;
  return doc.roles?.length ? doc.roles : ["candidate"];
}

async function rolesForUser(user: User): Promise<UserRole[]> {
  try {
    return await syncSession(user);
  } catch (err) {
    try {
      const existing = await getUser(user.uid);
      if (existing?.roles?.length) return existing.roles;
    } catch {
      // ignore
    }
    throw err;
  }
}

async function signInGoogleNative(): Promise<User> {
  const { FirebaseAuthentication } = await import(
    "@capacitor-firebase/authentication"
  );
  // Native account picker (Credential Manager). Do not use browser popup/redirect.
  const result = await FirebaseAuthentication.signInWithGoogle({
    useCredentialManager: true,
  });
  const idToken = result.credential?.idToken;
  if (!idToken) {
    throw new Error(
      "Google did not return an ID token. Confirm the Android SHA-1 is in Firebase and google-services.json is up to date.",
    );
  }
  const credential = GoogleAuthProvider.credential(
    idToken,
    result.credential?.accessToken,
  );
  const signedIn = await signInWithCredential(getClientAuth(), credential);
  return signedIn.user;
}

async function signInGoogleWeb(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const result = await signInWithPopup(getClientAuth(), provider);
  return result.user;
}

function authErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/database is closing|closing\/hidden/i.test(message)) {
    return "Google sign-in was interrupted. Close other auth windows, refresh, and try again.";
  }
  if (/popup|blocked|cancelled|canceled|12501|12500/i.test(message)) {
    return "Google sign-in was cancelled or blocked. Try again.";
  }
  if (/network|unavailable|offline/i.test(message)) {
    return "Network error during Google sign-in. Check your connection and try again.";
  }
  return message || "Google sign-in failed";
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
          setRoles((prev) => (prev.length ? prev : ["candidate"]));
        }
      } else {
        setRoles(["candidate"]);
      }
      setLoading(false);
    });
  }, []);

  const signInGoogle = useCallback(
    async (opts?: { onProgress?: (stage: "google" | "session") => void }) => {
      try {
        opts?.onProgress?.("google");
        // Never use popup inside the Android WebView — it opens Chrome and cannot return.
        const nextUser = isNativeApp()
          ? await signInGoogleNative()
          : await signInGoogleWeb();
        opts?.onProgress?.("session");
        const nextRoles = await rolesForUser(nextUser);
        setUser(nextUser);
        setRoles(nextRoles);
      } catch (err) {
        throw new Error(authErrorMessage(err));
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    if (isNativeApp()) {
      try {
        const { FirebaseAuthentication } = await import(
          "@capacitor-firebase/authentication"
        );
        await FirebaseAuthentication.signOut();
      } catch {
        // Web session still cleared below.
      }
    }
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
