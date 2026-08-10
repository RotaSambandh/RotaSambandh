import type { MetadataRoute } from "next";
import { appOrigin } from "@/shared/constants";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = appOrigin();
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/auth/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/employer/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
