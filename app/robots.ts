import type { MetadataRoute } from "next";
import { appOrigin } from "@/shared/constants";

export default function robots(): MetadataRoute.Robots {
  const base = appOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/jobs",
          "/jobs/",
          "/companies/",
          "/candidate/",
          "/employer/",
          "/admin/",
          "/api/",
          "/auth/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
