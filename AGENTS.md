<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RotaSambandh agent rules

## Data plane (non-negotiable)

```
Browser / APK UI  →  READ Realtime Database only
Browser / APK UI  →  WRITE Firestore (+ R2 for blobs)
Firestore / Admin APIs →  WRITE Firestore (mutations / session)
Cloud Functions   →  READ Firestore triggers → WRITE RTDB projections
```

- **Never** add `getDoc` / `getDocs` / `onSnapshot` from `firebase/firestore` under `app/` or `components/`.
- UI list/detail/tray/dashboard/profile/admin-queue reads go through `lib/dal/*-rtdb.ts` (or wrappers that call them).
- Firestore client reads are allowed **only** inside mutation helpers that load-before-write (e.g. status update), and Admin SDK on `app/api/**` / `lib/auth/session.ts` / `lib/dal/admin-server.ts`.
- Clients must not write RTDB (rules: `.write: false`). Mark-read and similar mutations write Firestore; Functions mirror into `inbox/`.

## Where code lives

| Concern | Path |
|---------|------|
| FS → RTDB projectors | `functions/src/projections/*`, triggers in `functions/src/index.ts` |
| Read-model version | `functions/src/constants.ts` → `READ_MODEL_VERSION` |
| Offline backfill | `cd functions && npm run rebuild:readmodels` (needs Admin creds) |
| RTDB rules | `database.rules.json` |
| UI read guardrail | `npm run check:ui-reads` |

## Two deploy surfaces

| Surface | Deploys | Does **not** deploy |
|---------|---------|---------------------|
| **Netlify** (Git `main`) | Next.js app, `app/api/**` | Cloud Functions, RTDB/Firestore rules |
| **Firebase CLI** | `functions`, `database` rules (and optionally `firestore`) | Netlify site |

After changing projectors or `database.rules.json`, run:

```bash
firebase deploy --only functions,database --project rotasambandh2
```

Then backfill if existing docs need re-projection:

```bash
cd functions && npm run build
FIREBASE_DATABASE_URL=https://rotasambandh2-default-rtdb.asia-southeast1.firebasedatabase.app \
  node --env-file=../.env.local lib/scripts/rebuildReadModels.js
```

## Candidate home / profile completion

- Home reads `candidate/{uid}/dashboard.profileCompletion` (Admin RTDB).
- Score is computed from club, district, headline, about, skills, LinkedIn, phone (`shared/profile-completion.ts`).
- `updateCandidateProfile` / `updateUserPhone` persist `completionScore` on Firestore; Functions sync dashboard + profile RTDB mirrors.
- Job feeds filter `readModelVersion === READ_MODEL_VERSION` — **keep `shared/constants.ts` and `functions/src/constants.ts` in lockstep**.

## Product docs

Human-facing architecture, scripts, and roles: [README.md](README.md). Visual system: [DESIGN.md](DESIGN.md).
