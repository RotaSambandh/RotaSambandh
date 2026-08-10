import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["firebase-admin"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "assets.rotasambandh.com" },
    ],
  },
  headers: async () => [
    {
      source: "/:path*",
      headers: [
        {
          key: "Cross-Origin-Opener-Policy",
          value: "same-origin-allow-popups",
        },
      ],
    },
    {
      source: "/candidate",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/candidate/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/jobs",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/jobs/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/companies",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/companies/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/employer/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
    {
      source: "/admin/:path*",
      headers: [{ key: "Cache-Control", value: "private, no-store" }],
    },
  ],
};

export default nextConfig;
