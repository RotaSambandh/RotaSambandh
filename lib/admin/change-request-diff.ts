import type { ChangeRequest } from "@/shared/types";

function formatDiffValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function changeRequestDiffRows(
  cr: ChangeRequest,
): Array<{ field: string; before?: string; after?: string }> {
  const live = cr.liveSnapshot ?? {};
  const proposed = cr.proposed ?? {};
  const keys = new Set([...Object.keys(live), ...Object.keys(proposed)]);
  return Array.from(keys)
    .sort()
    .map((field) => ({
      field,
      before: formatDiffValue(live[field]),
      after: formatDiffValue(proposed[field]),
    }));
}
