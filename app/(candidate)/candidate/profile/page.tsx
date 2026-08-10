"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { ensureUserDoc, getCandidateProfile, getUser, updateCandidateProfile, updateUserPhone } from "@/lib/dal/users";
import type { CandidateProfile } from "@/shared/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingBlock } from "@/components/ui";
import { ClubDistrictPicker } from "@/components/clubs/club-district-picker";

export default function CandidateProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      setError("Sign in to edit your profile.");
      return;
    }

    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        await ensureUserDoc({
          uid: user.uid,
          email: user.email ?? "",
          displayName: user.displayName ?? user.email ?? "User",
          photoURL: user.photoURL ?? undefined,
        });
        const [next, userDoc] = await Promise.all([
          getCandidateProfile(user.uid),
          getUser(user.uid),
        ]);
        if (!cancelled) {
          setPhone(userDoc?.phone ?? "");
          setProfile(
            next ?? {
              userId: user.uid,
              skills: [],
              experience: [],
              education: [],
              certifications: [],
              languages: [],
              completionScore: 0,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !profile) return;
    const fd = new FormData(e.currentTarget);
    const rotaractClub = String(fd.get("club") ?? "").trim();
    const rotaractDistrict = String(fd.get("district") ?? "").trim();
    if (!rotaractClub || !rotaractDistrict) {
      setMessage(null);
      setError("Select both your district and club.");
      return;
    }
    const patch = {
      headline: String(fd.get("headline")),
      about: String(fd.get("about")),
      rotaractClub,
      rotaractDistrict,
      skills: String(fd.get("skills"))
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      linkedInUrl: String(fd.get("linkedin")),
      portfolioUrl: String(fd.get("portfolio")),
    };
    await updateUserPhone(user.uid, String(fd.get("phone") ?? "").trim());
    await updateCandidateProfile(user.uid, patch);
    setPhone(String(fd.get("phone") ?? "").trim());
    setProfile({ ...profile, ...patch });
    setError(null);
    setMessage("Profile saved");
  }

  if (authLoading || loading) {
    return <LoadingBlock label="Loading profile…" />;
  }

  if (error || !profile) {
    return (
      <main className="text-sm text-[var(--color-danger)]" role="alert">
        {error ?? "Profile unavailable."}
      </main>
    );
  }

  return (
    <main>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Profile</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        This network is for Rotaractors. Keep your club, district, and skills current. Attach a
        resume each time you apply; it is not stored as a single profile default.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4 border border-[var(--color-border)] bg-white p-5">
        <div>
          <Label htmlFor="headline">Headline</Label>
          <Input id="headline" name="headline" defaultValue={profile.headline} />
        </div>
        <div>
          <Label htmlFor="about">About</Label>
          <Textarea id="about" name="about" rows={4} defaultValue={profile.about} />
        </div>
        <ClubDistrictPicker
          defaultClub={profile.rotaractClub ?? ""}
          defaultDistrict={profile.rotaractDistrict ?? ""}
        />
        <div>
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" type="tel" defaultValue={phone} required />
        </div>
        <div>
          <Label htmlFor="skills">Skills (comma separated)</Label>
          <Input id="skills" name="skills" defaultValue={profile.skills.join(", ")} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input id="linkedin" name="linkedin" defaultValue={profile.linkedInUrl} />
          </div>
          <div>
            <Label htmlFor="portfolio">Portfolio</Label>
            <Input id="portfolio" name="portfolio" defaultValue={profile.portfolioUrl} />
          </div>
        </div>
        <Button type="submit">Save profile</Button>
      </form>

      {error && (
        <p className="mt-4 text-sm text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="mt-4 text-sm text-[var(--color-success)]" role="status">
          {message}
        </p>
      )}
    </main>
  );
}
