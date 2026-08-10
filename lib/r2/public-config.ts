/**
 * Cloudflare R2 public identifiers — safe to commit (not credentials).
 * Access keys stay in Netlify / `.env.local` only:
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
 */
export const r2PublicConfig = {
  accountId: "19f9c805554a13b5909ca8dc829295ba",
  /** Private resumes / documents bucket */
  resumeBucket: "rotasambandh",
  /** Public company logos bucket */
  logosBucket: "rotasambandhassets",
  /** CDN / public base for logo objects */
  publicBaseUrl: "https://assets.rotasambandh.com",
} as const;
