import type { ChangeRequest } from "@/shared/types";
import { JOB_TYPE_LABELS, WORKPLACE_LABELS } from "@/lib/dal/job-meta";

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  description: "Description",
  responsibilities: "Responsibilities",
  requirements: "Requirements",
  benefits: "Benefits",
  skills: "Keywords",
  type: "Type",
  workplace: "Workplace",
  location: "Location",
  salaryDisplay: "Salary",
  deadline: "Deadline",
  industry: "Industry",
  name: "Company name",
  website: "Website",
  companySize: "Company size",
  logoUrl: "Logo",
  rotaryContactName: "Rotary contact",
  rotaryContactClub: "Club",
  rotaryContactEmail: "Contact email",
  rotaryContactPhone: "Contact phone",
};

const SKIP_FIELDS = new Set(["slug", "categoryIds"]);

const RICH_FIELDS = new Set([
  "description",
  "responsibilities",
  "requirements",
  "benefits",
]);

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDiffValue(field: string, value: unknown): string {
  if (value == null || value === "") return "";
  if (field === "type" && typeof value === "string") {
    return JOB_TYPE_LABELS[value as keyof typeof JOB_TYPE_LABELS] ?? value;
  }
  if (field === "workplace" && typeof value === "string") {
    return WORKPLACE_LABELS[value as keyof typeof WORKPLACE_LABELS] ?? value;
  }
  if (field === "deadline" && (typeof value === "number" || typeof value === "string")) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return new Date(n).toLocaleDateString();
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  const text = String(value);
  if (RICH_FIELDS.has(field)) {
    const plain = stripHtml(text);
    return plain.length > 180 ? `${plain.slice(0, 180)}...` : plain;
  }
  return text;
}

export function changeRequestDiffRows(
  cr: ChangeRequest,
): Array<{ field: string; before?: string; after?: string }> {
  const live = cr.liveSnapshot ?? {};
  const proposed = cr.proposed ?? {};
  const keys = new Set([...Object.keys(live), ...Object.keys(proposed)]);
  return Array.from(keys)
    .filter((field) => !SKIP_FIELDS.has(field))
    .sort()
    .map((field) => ({
      field: FIELD_LABELS[field] ?? field.replaceAll("_", " "),
      before: formatDiffValue(field, live[field]),
      after: formatDiffValue(field, proposed[field]),
    }))
    .filter((row) => (row.before ?? "") !== (row.after ?? ""));
}
