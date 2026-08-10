import type { CandidateProfile, UserDoc } from "@/shared/types";

/** Soft-gate for apply: club + phone required. Portfolio is never required. */
export function canApplyToJobs(
  profile: CandidateProfile | null | undefined,
  user: UserDoc | null | undefined,
): boolean {
  if (!profile || !user) return false;
  return Boolean(
    profile.rotaractClub?.trim() &&
      profile.rotaractDistrict?.trim() &&
      user.phone?.trim(),
  );
}

/** Progressive profile completeness (portfolio optional). */
export function isCandidateOnboardingComplete(
  profile: CandidateProfile | null | undefined,
  user: UserDoc | null | undefined,
): boolean {
  if (!profile || !user) return false;
  const phone = user.phone?.trim();
  return Boolean(
    profile.rotaractClub?.trim() &&
      profile.rotaractDistrict?.trim() &&
      profile.headline?.trim() &&
      profile.about?.trim() &&
      (profile.skills?.length ?? 0) > 0 &&
      profile.linkedInUrl?.trim() &&
      phone,
  );
}
