import type { CandidateProfile, UserDoc } from "@/shared/types";

/**
 * Fields that count toward candidate home "Profile completion %".
 * Matches soft-launch onboarding completeness (portfolio optional).
 */
export const PROFILE_COMPLETION_FIELDS = [
  "rotaractClub",
  "rotaractDistrict",
  "headline",
  "about",
  "skills",
  "linkedInUrl",
  "phone",
] as const;

export type ProfileCompletionField = (typeof PROFILE_COMPLETION_FIELDS)[number];

function filled(
  profile: Pick<
    CandidateProfile,
    "rotaractClub" | "rotaractDistrict" | "headline" | "about" | "skills" | "linkedInUrl"
  > | null | undefined,
  phone?: string | null,
): number {
  if (!profile) return 0;
  let n = 0;
  if (profile.rotaractClub?.trim()) n += 1;
  if (profile.rotaractDistrict?.trim()) n += 1;
  if (profile.headline?.trim()) n += 1;
  if (profile.about?.trim()) n += 1;
  if ((profile.skills?.length ?? 0) > 0) n += 1;
  if (profile.linkedInUrl?.trim()) n += 1;
  if (phone?.trim()) n += 1;
  return n;
}

/** 0–100 integer for dashboard / profile.completionScore. */
export function computeProfileCompletionPercent(
  profile: Pick<
    CandidateProfile,
    "rotaractClub" | "rotaractDistrict" | "headline" | "about" | "skills" | "linkedInUrl"
  > | null | undefined,
  userOrPhone?: Pick<UserDoc, "phone"> | string | null,
): number {
  const phone =
    typeof userOrPhone === "string"
      ? userOrPhone
      : userOrPhone?.phone ?? null;
  const n = filled(profile, phone);
  return Math.round((n / PROFILE_COMPLETION_FIELDS.length) * 100);
}
