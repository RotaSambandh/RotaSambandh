import { getDatabase } from "firebase-admin/database";
import { READ_MODEL_VERSION } from "../constants";

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

export async function projectCandidateProfile(
  uid: string,
  data: Record<string, unknown> | undefined,
) {
  if (!data) {
    await getDatabase().ref(`candidate/${uid}/profile`).remove();
    return;
  }
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
      completionScore: data.completionScore ?? 0,
      readModelVersion: READ_MODEL_VERSION,
      updatedAt: data.updatedAt ?? Date.now(),
    });
}
