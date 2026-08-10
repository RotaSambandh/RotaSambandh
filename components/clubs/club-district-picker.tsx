"use client";

import { useEffect, useMemo, useState } from "react";
import { MenuSelect } from "@/components/ui/menu-select";
import { LoadingBlock } from "@/components/ui";

type ClubsPayload = {
  districts: string[];
  clubs: string[];
  clubsByDistrict: Record<string, string[]>;
  districtByClub: Record<string, string>;
};

const CLUB_PREFIX = /^rotaract\s+club\s+of\s+/i;
const NO_MATCH_MESSAGE =
  "Can't find your club? Contact the RotaSambandh team so we can add it.";

function normalizeClubName(raw: string): string {
  return raw.trim().replace(CLUB_PREFIX, "").trim();
}

let cachedPayload: ClubsPayload | null = null;
let cachePromise: Promise<ClubsPayload> | null = null;

async function loadClubs(): Promise<ClubsPayload> {
  if (cachedPayload) return cachedPayload;
  if (!cachePromise) {
    cachePromise = fetch("/api/rotaract-clubs")
      .then((res) => {
        if (!res.ok) throw new Error("Could not load club list");
        return res.json() as Promise<ClubsPayload>;
      })
      .then((data) => {
        cachedPayload = data;
        return data;
      })
      .catch((err) => {
        cachePromise = null;
        throw err;
      });
  }
  return cachePromise;
}

export function ClubDistrictPicker({
  defaultClub = "",
  defaultDistrict = "",
  clubName = "club",
  districtName = "district",
}: {
  defaultClub?: string;
  defaultDistrict?: string;
  clubName?: string;
  districtName?: string;
}) {
  const [data, setData] = useState<ClubsPayload | null>(cachedPayload);
  const [error, setError] = useState<string | null>(null);
  const [district, setDistrict] = useState(defaultDistrict);
  const [club, setClub] = useState(() => normalizeClubName(defaultClub));

  useEffect(() => {
    let cancelled = false;
    void loadClubs()
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load clubs");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const districtOptions = useMemo(() => {
    if (!data) return [{ value: "", label: "Select district" }];
    return [
      { value: "", label: "Select district" },
      ...data.districts.map((d) => ({ value: d, label: d })),
    ];
  }, [data]);

  const clubOptions = useMemo(() => {
    if (!data) return [{ value: "", label: "Select club" }];
    const names = district ? (data.clubsByDistrict[district] ?? []) : data.clubs;
    return [
      { value: "", label: district ? "Select club" : "Select club (or pick district first)" },
      ...names.map((c) => ({ value: c, label: c })),
    ];
  }, [data, district]);

  function onDistrictChange(next: string) {
    setDistrict(next);
    if (!data || !club) return;
    const clubsInDistrict = data.clubsByDistrict[next] ?? [];
    if (club && !clubsInDistrict.includes(club)) setClub("");
  }

  function onClubChange(next: string) {
    setClub(next);
    if (!data || !next) return;
    const mapped = data.districtByClub[next];
    if (mapped) setDistrict(mapped);
  }

  if (error) {
    return (
      <p role="alert" className="text-sm text-[var(--color-danger)]">
        {error}. Check <code>data/rotaract-clubs.csv</code>.
      </p>
    );
  }

  if (!data) return <LoadingBlock label="Loading club list…" />;

  if (data.districts.length === 0) {
    return (
      <p role="alert" className="text-sm text-[var(--color-danger)]">
        No clubs found in <code>data/rotaract-clubs.csv</code>. Use headers{" "}
        <code>district,club_name</code>.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <input type="hidden" name={districtName} value={district} />
      <input type="hidden" name={clubName} value={club} />
      <MenuSelect
        id="district-picker"
        label="District"
        value={district}
        options={districtOptions}
        onValueChange={onDistrictChange}
        placeholder="Select district"
        searchable
        searchPlaceholder="Search district…"
        emptyMessage={NO_MATCH_MESSAGE}
      />
      <MenuSelect
        id="club-picker"
        label="Rotaract club"
        value={club}
        options={clubOptions}
        onValueChange={onClubChange}
        placeholder="Select club"
        searchable
        searchPlaceholder="Search club…"
        emptyMessage={NO_MATCH_MESSAGE}
      />
    </div>
  );
}
