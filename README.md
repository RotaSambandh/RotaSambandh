# RotaSambandh

**Rotaract Career Network.** Connecting Rotaractors with verified Rotary-linked businesses.

> Trusted opportunities. Shared networks. Stronger careers.

## Stack

- Next.js + TypeScript + Tailwind (Netlify)
- Firebase Auth, Firestore (source of truth), Realtime Database (read models), Cloud Functions
- Cloudflare R2 for resumes/documents
- PWA + Capacitor Android (same codebase)

## Data architecture

- **Writes:** Firestore (source of truth) + Cloudflare R2 for binaries
- **UI reads:** Realtime Database projections only (feeds, dashboards, applications, inbox, employer workspace, admin queues, taxonomy, user/profile slices)
- **Sync:** Cloud Functions in `functions/src` project Firestore → RTDB (`READ_MODEL_VERSION` in `functions/src/constants.ts`)
- **Allowed Firestore reads:** mutation helpers, Admin SDK session/privileged APIs, Function triggers — not page-load UI lists
- **Rebuild:** `cd functions && npm run rebuild:readmodels` after projection changes
- **Guardrail:** `npm run check:ui-reads` (no `firebase/firestore` imports under `app/` / `components/`)

### Firestore read exceptions (server / mutations only)

| Path | Why |
|------|-----|
| `lib/dal/*` write helpers (`setDoc` / `updateDoc` + load-before-mutate) | Mutations need SoT |
| `app/api/auth/session`, `ensure-employer`, privileged admin APIs | Claims sync / privileged writes |
| `functions/src/**` triggers + rebuild scripts | Project FS → RTDB |
| Cloud Function Admin SDK | Never exposed to browser |

## Quick start

```bash
npm install
cp .env.example .env.local   # secrets only (Admin + R2)
# Fill lib/firebase/public-config.ts from Firebase Console (public web config)
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
| `npm run functions:build` | Compile Cloud Functions |
| `npm run cap:sync` | Sync Capacitor config |

### Firebase functions

```bash
cd functions && npm install && npm run build
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
