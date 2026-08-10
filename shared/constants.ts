export const APP_NAME = "RotaSambandh";
export const DISPLAY_NAME = "Rotaract Career Network";
export const TAGLINE =
  "Trusted opportunities. Shared networks. Stronger careers.";

/** Canonical production origin (custom domain). Override with NEXT_PUBLIC_APP_URL. */
export const PRODUCTION_APP_URL = "https://rotasambandh.com";

export function appOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || PRODUCTION_APP_URL
  );
}

/** Must match `functions/src/constants.ts` — bump both when read-model shape changes. */
export const READ_MODEL_VERSION = 2;

export const MAX_RESUME_BYTES = 2 * 1024 * 1024;
export const ALLOWED_RESUME_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_LOGO_BYTES = 1 * 1024 * 1024;
export const MAX_LOGO_SOURCE_BYTES = 4 * 1024 * 1024;
export const ALLOWED_LOGO_MIME = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_EDGE = 512;
export const LOGO_WEBP_QUALITY = 0.92;

export const APPLICANTS_PAGE_SIZE = 20;
export const ADMIN_PAGE_SIZE = 25;
export const FEED_PAGE_SIZE = 30;
export const NOTIFICATION_INBOX_CAP = 50;

export const CACHE_TAGS = {
  job: (id: string) => `job:${id}`,
  business: (id: string) => `business:${id}`,
  feed: (channel: string) => `feed:${channel}`,
} as const;
