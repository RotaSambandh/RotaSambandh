/** Escape a CSV cell (RFC 4180-ish). */
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map((cell) => csvEscape(cell ?? "")).join(",")),
  ];
  // BOM helps Excel open UTF-8 correctly
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}
