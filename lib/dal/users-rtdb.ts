import { get, ref } from "firebase/database";
import type { CandidateProfile, UserDoc, UserRole } from "@/shared/types";
import { getClientRtdb, isFirebaseConfigured } from "@/lib/firebase/client";

export async function getUserRtdb(uid: string): Promise<UserDoc | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await get(ref(getClientRtdb(), `users/${uid}`));
    if (!snap.exists()) return null;
    const u = snap.val() as Record<string, unknown>;
    return {
      uid,
      email: String(u.email ?? ""),
      displayName: String(u.displayName ?? ""),
      photoURL: u.photoURL ? String(u.photoURL) : undefined,
      phone: u.phone ? String(u.phone) : undefined,
      roles: (u.roles as UserRole[]) ?? ["candidate"],
      activeBusinessId: u.activeBusinessId
        ? String(u.activeBusinessId)
        : undefined,
      suspended: Boolean(u.suspended),
      createdAt: Number(u.updatedAt ?? 0),
      updatedAt: Number(u.updatedAt ?? 0),
    };
  } catch {
    return null;
  }
}

export async function getCandidateProfileRtdb(
  uid: string,
): Promise<CandidateProfile | null> {
  if (!isFirebaseConfigured()) return null;
  try {
    const snap = await get(ref(getClientRtdb(), `candidate/${uid}/profile`));
    if (!snap.exists()) return null;
    const p = snap.val() as Record<string, unknown>;
    return {
      userId: uid,
      headline: p.headline ? String(p.headline) : undefined,
      about: p.about ? String(p.about) : undefined,
      rotaractClub: p.rotaractClub ? String(p.rotaractClub) : undefined,
      rotaractDistrict: p.rotaractDistrict
        ? String(p.rotaractDistrict)
        : undefined,
      skills: (p.skills as string[]) ?? [],
      experience: (p.experience as CandidateProfile["experience"]) ?? [],
      education: (p.education as CandidateProfile["education"]) ?? [],
      certifications:
        (p.certifications as CandidateProfile["certifications"]) ?? [],
      languages: (p.languages as CandidateProfile["languages"]) ?? [],
      portfolioUrl: p.portfolioUrl ? String(p.portfolioUrl) : undefined,
      linkedInUrl: p.linkedInUrl ? String(p.linkedInUrl) : undefined,
      membershipVerified: Boolean(p.membershipVerified),
      discoverable: Boolean(p.discoverable),
      primaryResumeId: p.primaryResumeId
        ? String(p.primaryResumeId)
        : undefined,
      completionScore: Number(p.completionScore ?? 0),
      createdAt: Number(p.updatedAt ?? 0),
      updatedAt: Number(p.updatedAt ?? 0),
    };
  } catch {
    return null;
  }
}
