/**
 * Firestore rules regression checks for Phase 0 trust boundary.
 * Run with the Firestore emulator:
 *   firebase emulators:exec --only firestore "npm run test:rules"
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";

const PROJECT_ID = "rotasambandh2-rules-test";
const rulesPath = join(process.cwd(), "firestore.rules");

describe("firestore.rules file", () => {
  it("locks down self-verify and open reads", () => {
    const rules = readFileSync(rulesPath, "utf8");
    assert.match(rules, /function isSuspended/);
    assert.match(rules, /isOwnerBootstrapMember/);
    assert.doesNotMatch(
      rules,
      /match \/applicationAnswers\/\{id\} \{\s*allow read: if signedIn\(\)/,
    );
    assert.match(rules, /request\.resource\.data\.status in \['draft', 'verification_pending'\]/);
    assert.match(rules, /candidateProfiles\/\{uid\}/);
    assert.match(rules, /allow read: if isSelf\(uid\) \|\| isPlatformStaff\(\)/);
  });
});

describe("firestore rules emulator suite", () => {
  const hasEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);

  before(async () => {
    if (!hasEmulator) return;
  });

  after(async () => {
    if (!hasEmulator) return;
  });

  it("skips live emulator cases unless FIRESTORE_EMULATOR_HOST is set", async () => {
    if (!hasEmulator) {
      assert.ok(true, "static rules assertions above still ran");
      return;
    }

    const {
      initializeTestEnvironment,
      assertFails,
      assertSucceeds,
    } = await import("@firebase/rules-unit-testing");

    const rules = readFileSync(rulesPath, "utf8");
    const testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules },
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await db.doc("businesses/biz1").set({
        ownerId: "owner1",
        status: "draft",
        name: "Co",
      });
      await db.doc("users/attacker").set({
        uid: "attacker",
        roles: ["candidate"],
        email: "a@x.com",
        displayName: "A",
      });
      await db.doc("users/owner1").set({
        uid: "owner1",
        roles: ["employer"],
        email: "o@x.com",
        displayName: "O",
      });
    });

    const attacker = testEnv.authenticatedContext("attacker");
    await assertFails(
      attacker.firestore().doc("businessMembers/biz1_attacker").set({
        id: "biz1_attacker",
        businessId: "biz1",
        userId: "attacker",
        role: "company_admin",
        status: "active",
      }),
    );

    await assertFails(
      attacker.firestore().doc("businesses/biz1").update({ status: "verified" }),
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc("applications/app1").set({
        candidateId: "cand1",
        businessId: "biz1",
        status: "applied",
      });
      await context.firestore().doc("applicationAnswers/ans1").set({
        applicationId: "app1",
        promptSnapshot: "Q",
      });
      await context.firestore().doc("candidateProfiles/cand1").set({
        userId: "cand1",
        skills: [],
      });
    });

    await assertFails(attacker.firestore().doc("applicationAnswers/ans1").get());
    await assertFails(attacker.firestore().doc("candidateProfiles/cand1").get());

    const owner = testEnv.authenticatedContext("owner1");
    await assertSucceeds(
      owner.firestore().doc("businessMembers/biz1_owner1").set({
        id: "biz1_owner1",
        businessId: "biz1",
        userId: "owner1",
        role: "company_admin",
        status: "active",
      }),
    );

    await testEnv.cleanup();
  });
});
