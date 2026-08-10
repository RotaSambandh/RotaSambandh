import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApplyToJobs,
  isCandidateOnboardingComplete,
} from "../lib/dal/onboarding-gates";
import type { CandidateProfile, UserDoc } from "../shared/types";

function profile(partial: Partial<CandidateProfile> = {}): CandidateProfile {
  return {
    userId: "u1",
    skills: [],
    experience: [],
    education: [],
    certifications: [],
    languages: [],
    completionScore: 0,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

function user(partial: Partial<UserDoc> = {}): UserDoc {
  return {
    uid: "u1",
    email: "a@b.com",
    displayName: "A",
    roles: ["candidate"],
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe("canApplyToJobs", () => {
  it("requires club, district, and phone", () => {
    assert.equal(
      canApplyToJobs(
        profile({ rotaractClub: "East", rotaractDistrict: "3191" }),
        user({ phone: "+91" }),
      ),
      true,
    );
    assert.equal(
      canApplyToJobs(profile({ rotaractClub: "East", rotaractDistrict: "3191" }), user()),
      false,
    );
    assert.equal(canApplyToJobs(profile(), user({ phone: "+91" })), false);
  });

  it("does not require portfolio", () => {
    assert.equal(
      canApplyToJobs(
        profile({ rotaractClub: "East", rotaractDistrict: "3191" }),
        user({ phone: "1" }),
      ),
      true,
    );
  });
});

describe("isCandidateOnboardingComplete", () => {
  it("requires professional fields but not portfolio", () => {
    const p = profile({
      rotaractClub: "East",
      rotaractDistrict: "3191",
      headline: "H",
      about: "A",
      skills: ["x"],
      linkedInUrl: "https://linkedin.com/in/x",
    });
    assert.equal(isCandidateOnboardingComplete(p, user({ phone: "1" })), true);
    assert.equal(
      isCandidateOnboardingComplete({ ...p, portfolioUrl: undefined }, user({ phone: "1" })),
      true,
    );
    assert.equal(
      isCandidateOnboardingComplete({ ...p, linkedInUrl: "" }, user({ phone: "1" })),
      false,
    );
  });
});
