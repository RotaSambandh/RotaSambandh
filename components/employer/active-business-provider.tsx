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
import { useAuth } from "@/components/auth/auth-provider";
import { setActiveBusinessId as persistActiveBusinessId } from "@/lib/dal/employer";
import { resolveActiveBusinessRtdb } from "@/lib/dal/employer-rtdb";
import type { Business } from "@/shared/types";

interface ActiveBusinessContextValue {
  businesses: Business[];
  business: Business | null;
  loading: boolean;
  setActiveBusiness: (businessId: string) => Promise<void>;
  refreshBusinesses: () => Promise<void>;
}

const ActiveBusinessContext = createContext<ActiveBusinessContextValue | null>(null);

export function ActiveBusinessProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshBusinesses = useCallback(async () => {
    if (!user) {
      setBusinesses([]);
      setBusiness(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const resolved = await resolveActiveBusinessRtdb(user.uid);
      setBusinesses(resolved.businesses);
      setBusiness(resolved.business);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refreshBusinesses();
  }, [refreshBusinesses]);

  const setActiveBusiness = useCallback(
    async (businessId: string) => {
      if (!user) return;
      const next = businesses.find((b) => b.id === businessId) ?? null;
      if (!next) return;
      setBusiness(next);
      try {
        await persistActiveBusinessId(user.uid, businessId);
      } catch {
        // Local selection still works if persistence fails.
      }
    },
    [user, businesses],
  );

  const value = useMemo(
    () => ({
      businesses,
      business,
      loading,
      setActiveBusiness,
      refreshBusinesses,
    }),
    [businesses, business, loading, setActiveBusiness, refreshBusinesses],
  );

  return (
    <ActiveBusinessContext.Provider value={value}>{children}</ActiveBusinessContext.Provider>
  );
}

export function useActiveBusiness(): ActiveBusinessContextValue {
  const ctx = useContext(ActiveBusinessContext);
  if (!ctx) {
    throw new Error("useActiveBusiness must be used within ActiveBusinessProvider");
  }
  return ctx;
}

/** Safe outside employer layout (e.g. shared sidebar). */
export function useOptionalActiveBusiness(): ActiveBusinessContextValue | null {
  return useContext(ActiveBusinessContext);
}
