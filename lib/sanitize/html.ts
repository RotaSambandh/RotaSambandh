import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = ["p", "br", "strong", "em", "b", "i", "ul", "ol", "li", "a"];
const ALLOWED_ATTR = ["href", "target", "rel"];
/** Soft cap for sanitized company description HTML. */
export const MAX_COMPANY_DESCRIPTION_CHARS = 20_000;

export function sanitizeCompanyHtml(html: string): string {
  const cleaned = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^https:\/\//i,
  }).trim();
  return cleaned.length > MAX_COMPANY_DESCRIPTION_CHARS
    ? cleaned.slice(0, MAX_COMPANY_DESCRIPTION_CHARS)
    : cleaned;
}

export function isNonEmptyHtml(html: string): boolean {
  const text = sanitizeCompanyHtml(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > 0;
}

export function htmlToPlainText(html: string): string {
  return sanitizeCompanyHtml(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
