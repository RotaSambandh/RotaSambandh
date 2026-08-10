import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import type { CandidateProfile, UserDoc, UserRole } from "@/shared/types";
import { getClientFirestore, isFirebaseConfigured } from "@/lib/firebase/client";
import { now, omitUndefined } from "@/lib/utils";
import {
  canApplyToJobs,
  isCandidateOnboardingComplete,
} from "@/lib/dal/onboarding-gates";

export { canApplyToJobs, isCandidateOnboardingComplete };

function emptyCandidateProfile(
  uid: string,
  extras: Partial<CandidateProfile> = {},
): Record<string, unknown> {
  const ts = now();
  const club = extras.rotaractClub?.trim();
  const district = extras.rotaractDistrict?.trim();
  return omitUndefined({
    userId: uid,
    skills: extras.skills ?? [],
    experience: extras.experience ?? [],
    education: extras.education ?? [],
    certifications: extras.certifications ?? [],
    languages: extras.languages ?? [],
    headline: extras.headline,
    about: extras.about,
    portfolioUrl: extras.portfolioUrl,
    linkedInUrl: extras.linkedInUrl,
    rotaractClub: club || undefined,
    rotaractDistrict: district || undefined,
    membershipVerified: extras.membershipVerified,
    discoverable: extras.discoverable,
    primaryResumeId: extras.primaryResumeId,
    completionScore: club ? 25 : (extras.completionScore ?? 10),
    createdAt: extras.createdAt ?? ts,
    updatedAt: ts,
  });
}

/**
 * Ensures the auth user has a Firestore `users` doc.
 * Never overwrites existing roles (preserves super_admin / employer / etc.).
 * Lazily creates a candidate profile shell so multi-role accounts can use the
 * candidate portal without separate signup.
 */
export async function ensureUserDoc(input: {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  roles?: UserRole[];
  rotaractClub?: string;
  rotaractDistrict?: string;
}): Promise<UserDoc> {
  const ts = now();
  const draftUser = omitUndefined({
    uid: input.uid,
    email: input.email,
    displayName: input.displayName,
    photoURL: input.photoURL,
    roles: input.roles ?? ["candidate"],
    createdAt: ts,
    updatedAt: ts,
  }) as UserDoc;

  if (!isFirebaseConfigured()) return draftUser;

  const db = getClientFirestore();
  const ref = doc(db, "users", input.uid);
  const existing = await getDoc(ref);

  let userDoc: UserDoc;
  if (!existing.exists()) {
    await setDoc(ref, draftUser);
    userDoc = draftUser;
  } else {
    userDoc = existing.data() as UserDoc;
    // Keep profile photo / display name fresh without touching roles.
    const patch = omitUndefined({
      email: input.email,
      displayName: input.displayName,
      photoURL: input.photoURL,
      updatedAt: ts,
    });
    if (Object.keys(patch).length > 0) {
      await updateDoc(ref, patch);
      userDoc = { ...userDoc, ...patch };
    }
  }

  // Every account can enter the candidate portal; profile is separate from roles.
  const profileRef = doc(db, "candidateProfiles", input.uid);
  const profileSnap = await getDoc(profileRef);
  if (!profileSnap.exists()) {
    await setDoc(
      profileRef,
      emptyCandidateProfile(input.uid, {
        rotaractClub: input.rotaractClub,
        rotaractDistrict: input.rotaractDistrict,
      }),
    );
  }

  return userDoc;
}

export async function getUser(uid: string): Promise<UserDoc | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getClientFirestore(), "users", uid));
  return snap.exists() ? (snap.data() as UserDoc) : null;
}

export async function getCandidateProfile(uid: string): Promise<CandidateProfile | null> {
  if (!isFirebaseConfigured()) return null;
  const snap = await getDoc(doc(getClientFirestore(), "candidateProfiles", uid));
  return snap.exists() ? (snap.data() as CandidateProfile) : null;
}

export async function updateCandidateProfile(
  uid: string,
  patch: Partial<CandidateProfile>,
): Promise<void> {
  if (!isFirebaseConfigured()) return;
  const ref = doc(getClientFirestore(), "candidateProfiles", uid);
  const existing = await getDoc(ref);
  const ts = now();
  const cleaned = omitUndefined({
    ...patch,
    rotaractClub: patch.rotaractClub?.trim() || undefined,
    rotaractDistrict: patch.rotaractDistrict?.trim() || undefined,
  } as Record<string, unknown>) as Partial<CandidateProfile>;

  if (!existing.exists()) {
    await setDoc(ref, emptyCandidateProfile(uid, cleaned));
    return;
  }
  await updateDoc(ref, {
    ...cleaned,
    updatedAt: ts,
  });
}

export async function updateUserPhone(uid: string, phone: string): Promise<void> {
  if (!isFirebaseConfigured()) return;
  await updateDoc(doc(getClientFirestore(), "users", uid), {
    phone: phone.trim(),
    updatedAt: now(),
  });
}
