/**
 * Google Analytics 4 - public client ID (safe to commit).
 * Paste Measurement ID from GA Admin → Data streams → Web (G-XXXXXXXX).
 * Leave empty to disable.
 */
export const gaMeasurementId = "G-DL4ENLGE3G";

export function isGaConfigured(): boolean {
  return Boolean(gaMeasurementId && gaMeasurementId.startsWith("G-"));
}
