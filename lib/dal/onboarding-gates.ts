import type { CandidateProfile, UserDoc } from "@/shared/types";
import { computeProfileCompletionPercent } from "@/shared/profile-completion";

export { computeProfileCompletionPercent } from "@/shared/profile-completion";

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
  return computeProfileCompletionPercent(profile, user) === 100;
}
