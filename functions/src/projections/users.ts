import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";
import { READ_MODEL_VERSION } from "../constants";

/** Keep in sync with shared/profile-completion.ts */
const COMPLETION_FIELD_COUNT = 7;

export function computeProfileCompletionPercent(
  profile: Record<string, unknown> | null | undefined,
  phone?: string | null,
): number {
  if (!profile) return 0;
  let n = 0;
  if (String(profile.rotaractClub ?? "").trim()) n += 1;
  if (String(profile.rotaractDistrict ?? "").trim()) n += 1;
  if (String(profile.headline ?? "").trim()) n += 1;
  if (String(profile.about ?? "").trim()) n += 1;
  if (Array.isArray(profile.skills) && profile.skills.length > 0) n += 1;
  if (String(profile.linkedInUrl ?? "").trim()) n += 1;
  if (String(phone ?? "").trim()) n += 1;
  return Math.round((n / COMPLETION_FIELD_COUNT) * 100);
}

export async function projectUserSlice(uid: string, data: Record<string, unknown> | undefined) {
  if (!data) {
    await getDatabase().ref(`users/${uid}`).remove();
    return;
  }
  await getDatabase()
    .ref(`users/${uid}`)
    .set({
      uid,
      email: data.email ?? "",
      displayName: data.displayName ?? "",
      photoURL: data.photoURL ?? "",
      phone: data.phone ?? "",
      roles: data.roles ?? ["candidate"],
      activeBusinessId: data.activeBusinessId ?? "",
      suspended: Boolean(data.suspended),
      readModelVersion: READ_MODEL_VERSION,
      updatedAt: data.updatedAt ?? Date.now(),
    });
}

export async function syncCandidateDashboardCompletion(
  uid: string,
  profile: Record<string, unknown> | undefined,
  phone?: string | null,
) {
  let resolvedPhone = phone;
  if (resolvedPhone === undefined) {
    try {
      const userSnap = await getFirestore().doc(`users/${uid}`).get();
      resolvedPhone = (userSnap.data()?.phone as string | undefined) ?? "";
    } catch {
      resolvedPhone = "";
    }
  }
  const score = computeProfileCompletionPercent(profile, resolvedPhone);
  const db = getDatabase();
  const dashRef = db.ref(`candidate/${uid}/dashboard`);
  await dashRef.transaction((current) => {
    const c = (current ?? {
      applications: 0,
      underReview: 0,
      interviews: 0,
      savedJobs: 0,
      profileCompletion: 0,
    }) as Record<string, number>;
    return {
      applications: c.applications ?? 0,
      underReview: c.underReview ?? 0,
      interviews: c.interviews ?? 0,
      savedJobs: c.savedJobs ?? 0,
      profileCompletion: score,
      readModelVersion: READ_MODEL_VERSION,
    };
  });
  if (profile) {
    await db.ref(`candidate/${uid}/profile/completionScore`).set(score);
  }
  return score;
}

export async function projectCandidateProfile(
  uid: string,
  data: Record<string, unknown> | undefined,
) {
  if (!data) {
    await getDatabase().ref(`candidate/${uid}/profile`).remove();
    await syncCandidateDashboardCompletion(uid, undefined, "");
    return;
  }

  let phone = "";
  try {
    const userSnap = await getFirestore().doc(`users/${uid}`).get();
    phone = String(userSnap.data()?.phone ?? "");
  } catch {
    phone = "";
  }
  const completionScore = computeProfileCompletionPercent(data, phone);

  await getDatabase()
    .ref(`candidate/${uid}/profile`)
    .set({
      userId: uid,
      headline: data.headline ?? "",
      about: data.about ?? "",
      rotaractClub: data.rotaractClub ?? "",
      rotaractDistrict: data.rotaractDistrict ?? "",
      skills: data.skills ?? [],
      experience: data.experience ?? [],
      education: data.education ?? [],
      certifications: data.certifications ?? [],
      languages: data.languages ?? [],
      portfolioUrl: data.portfolioUrl ?? "",
      linkedInUrl: data.linkedInUrl ?? "",
      membershipVerified: Boolean(data.membershipVerified),
      discoverable: Boolean(data.discoverable),
      primaryResumeId: data.primaryResumeId ?? "",
      completionScore,
      readModelVersion: READ_MODEL_VERSION,
      updatedAt: data.updatedAt ?? Date.now(),
    });

  await syncCandidateDashboardCompletion(uid, data, phone);
}
