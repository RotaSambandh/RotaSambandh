export async function callPrivilegedAdmin(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/privileged", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    ok?: boolean;
    recipients?: number;
    cappedAt?: number;
    roles?: string[];
  };
  if (!res.ok) throw new Error(data.error ?? "Privileged action failed");
  return data;
}
