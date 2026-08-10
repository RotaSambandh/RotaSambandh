"use client";

import { AuthProvider } from "@/components/auth/auth-provider";
import { NativeShell } from "@/components/native/native-shell";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NativeShell />
      {children}
    </AuthProvider>
  );
}
