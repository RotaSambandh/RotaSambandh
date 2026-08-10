import "server-only";
import { readFileSync } from "fs";
import { join } from "path";

export type RotaractClubRow = {
  district: string;
  club_name: string;
};

function parseCsv(text: string): RotaractClubRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const districtIdx = header.findIndex((h) => h === "district" || h === "district_number" || h === "district_no");
  const clubIdx = header.findIndex(
    (h) => h === "club_name" || h === "club" || h === "clubname" || h === "name",
  );
  if (districtIdx < 0 || clubIdx < 0) return [];

  const rows: RotaractClubRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]!);
    const district = (cols[districtIdx] ?? "").trim();
    const club_name = normalizeClubName(cols[clubIdx] ?? "");
    if (!district || !club_name) continue;
    rows.push({ district, club_name });
  }
  return rows;
}

/** Strip optional "Rotaract Club of" so CSV can use short names only. */
export function normalizeClubName(raw: string): string {
  return raw
    .trim()
    .replace(/^rotaract\s+club\s+of\s+/i, "")
    .trim();
}

/** Minimal CSV split that respects double-quoted fields. */
function splitCsvLine(line: string): string[] {
  const cols: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cols.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  cols.push(current);
  return cols;
}

function loadRows(): RotaractClubRow[] {
  try {
    const text = readFileSync(join(process.cwd(), "data/rotaract-clubs.csv"), "utf8");
    return parseCsv(text);
  } catch {
    return [];
  }
}

const rows = loadRows();

export function getRotaractClubs(): RotaractClubRow[] {
  return rows;
}

export function getRotaractDistricts(): string[] {
  return Array.from(new Set(rows.map((r) => r.district))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

export function getClubsForDistrict(district: string): string[] {
  const d = district.trim();
  return rows
    .filter((r) => r.district === d)
    .map((r) => r.club_name)
    .sort((a, b) => a.localeCompare(b));
}

export function getDistrictForClub(clubName: string): string | null {
  const club = normalizeClubName(clubName).toLowerCase();
  const match = rows.find((r) => r.club_name.toLowerCase() === club);
  return match?.district ?? null;
}

export function getAllClubNames(): string[] {
  return Array.from(new Set(rows.map((r) => r.club_name))).sort((a, b) => a.localeCompare(b));
}
