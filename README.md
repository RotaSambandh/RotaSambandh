[![Netlify Status](https://api.netlify.com/api/v1/badges/ca35a190-f2cd-4eb8-8520-5a11c4259735/deploy-status)](https://app.netlify.com/projects/rotasambandh/deploys)

# RotaSambandh

**Rotaract Career Network.** Connecting Rotaractors with verified Rotary-linked businesses.

> Trusted opportunities. Shared networks. Stronger careers.

## Stack

- Next.js + TypeScript + Tailwind (**Netlify**)
- Firebase Auth, Firestore (write / SoT), Realtime Database (UI read models), Cloud Functions (**Firebase CLI**)
- Cloudflare R2 for resumes/documents
- PWA (installable web app; Web Push)

## Data architecture

```
UI (browser / PWA) ──read──► Realtime Database
UI (browser / PWA) ──write─► Firestore (+ R2 blobs)
Next Admin APIs   ──write─► Firestore (mutations / session only)
Cloud Functions   ◄─FS triggers─ Firestore ──project──► RTDB
```

| Rule | Detail |
|------|--------|
| **UI reads** | RTDB only — feeds, dashboards, applications, inbox, employer workspace, admin queues, taxonomy, user/profile slices |
| **Writes** | Firestore is source of truth; R2 for binaries |
| **Sync** | `functions/src` projectors (`READ_MODEL_VERSION` in `functions/src/constants.ts`) |
| **Client RTDB writes** | Forbidden (rules `.write: false`). Mark-read writes Firestore; Functions mirror `inbox/` |
| **Guardrail** | `npm run check:ui-reads` |

### Allowed Firestore reads (exceptions only)

| Path | Why |
|------|-----|
| `lib/dal/*` mutation helpers (`setDoc` / `updateDoc` + load-before-mutate) | Mutations need SoT |
| `app/api/auth/session`, `ensure-employer`, privileged admin APIs | Claims sync / privileged writes |
| `functions/src/**` triggers + rebuild scripts | Project FS → RTDB |

Do **not** use client Firestore `getDoc` / `getDocs` for page lists or trays. Prefer `lib/dal/*-rtdb.ts`.

Agent-facing rules (including Next.js notes): [AGENTS.md](AGENTS.md).

## Deploy (two surfaces)

Netlify and Firebase are **independent**. Pushing to Git updates the site; it does **not** update Cloud Functions or database rules.

| What changed | Deploy with |
|--------------|-------------|
| `app/`, `components/`, `lib/`, Netlify config | Git push → Netlify |
| `functions/src/**` | `firebase deploy --only functions --project rotasambandh2` |
| `database.rules.json` | `firebase deploy --only database --project rotasambandh2` |
| `firestore.rules` / indexes | `firebase deploy --only firestore --project rotasambandh2` |

Typical after a read-model change:

```bash
firebase deploy --only functions,database --project rotasambandh2
cd functions && npm run build
FIREBASE_DATABASE_URL=https://rotasambandh2-default-rtdb.asia-southeast1.firebasedatabase.app \
  node --env-file=../.env.local lib/scripts/rebuildReadModels.js
```

Rebuild needs `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY` in `.env.local` (or `GOOGLE_APPLICATION_CREDENTIALS`).

## Quick start

```bash
npm install
cp .env.example .env.local   # secrets only (Admin + R2)
# Fill lib/firebase/public-config.ts from Firebase Console (public web config)
npm run functions:install && npm run functions:build
npm run dev
```

Auth is **Google sign-in only** on every portal. Enable the Google provider in Firebase Console → Authentication.

### Config split

| Kind | Where |
|------|--------|
| Firebase Web SDK + VAPID (public) | `lib/firebase/public-config.ts` |
| GA4 Measurement ID (public) | `lib/observability/public-config.ts` |
| R2 account / buckets / CDN (public) | `lib/r2/public-config.ts` |
| Non-secret Netlify flags | `netlify.toml` (`NEXT_PUBLIC_APP_URL=https://rotasambandh.com`, Node) |
| Secrets | Netlify UI / `.env.local` (`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) |

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js local server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run check:ui-reads` | Guardrail: no Firestore SDK in UI layers |
| `npm test` | Unit + static rules assertions |
| `npm run test:rules` | Firestore rules emulator suite |
| `npm run seed:super-admin` | Promote `SUPER_ADMIN_EMAIL` to super admin |
| `npm run functions:install` | Install Functions deps |
| `npm run functions:build` | Compile Cloud Functions |
| `cd functions && npm run rebuild:readmodels` | Backfill RTDB from Firestore (needs Admin env) |

### Firebase project

- Project id: `rotasambandh2`
- RTDB: `https://rotasambandh2-default-rtdb.asia-southeast1.firebasedatabase.app`

```bash
cd functions && npm install && npm run build
firebase deploy --only functions,database --project rotasambandh2
```

## Design

See [DESIGN.md](DESIGN.md) for the visual system.

## Roles / portals

| Portal | App | Auth |
|--------|-----|------|
| Candidate | `/candidate`, `/jobs`, `/companies` (shared portal layout) | `/auth/sign-in`, `/auth/sign-up` (Google) |
| Employer | `/employer` | `/employer/sign-in`, `/employer/sign-up` (Google) |
| Admin (invite-only) | `/admin` | `/admin/sign-in` (Google) |

There is **no public admin signup** and **no email/password auth**. Pre-seed the first super admin after they sign in once with Google:

```bash
# 1. Sign in at /admin/sign-in with Google (creates Auth user)
# 2. Put SUPER_ADMIN_EMAIL + Firebase Admin secrets in .env.local
npm run seed:super-admin
```

| Platform role | Access |
|---------------|--------|
| `super_admin` | Full admin ops + promote/demote staff |
| `admin` | Approve/reject, suspend, moderate |
| `coordinator` | View queues, stats, business/team context (no writes) |

| Business role | Access |
|---------------|--------|
| `company_admin` | Owns the company; invites managers by Google email |
| `manager` | Hiring team; must Google-sign-in with the invited email |
