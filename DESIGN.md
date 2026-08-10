# RotaSambandh Design System

**Product:** Rotaract Career Network (display) · RotaSambandh (brand mark)  
**Tagline:** Trusted opportunities. Shared networks. Stronger careers.

## Visual direction

Corporate-modern career network aligned with Rotary visual identity: deep navy for trust, slate for calm readability, pure white for clarity. Accents: electric blue for action, emerald for growth/success, soft amber for pending/caution. Typography follows Rotary’s free digital fonts (Open Sans Condensed / Open Sans / Georgia). Mobile-first, low-friction. Prefer tonal borders and whitespace over decorative imagery or heavy card chrome.

## Brand test

The first viewport must still read as RotaSambandh after removing navigation. The wordmark is the hero signal.

## Color

### Primary

| Token | Value | Psychology / use |
|-------|-------|------------------|
| `--color-navy-deep` | `#0a2540` | Deep Navy Blue - trust & security (brand ink, hero type) |
| `--color-navy` | `#0f3358` | Supporting navy |
| `--color-muted` | `#475569` | Slate Gray - readable secondary text |
| `--color-surface` | `#f1f5f9` | Slate-tinted neutral page background |
| `--color-surface-elevated` | `#ffffff` | Pure White - uncluttered panels / headers |
| `--color-border` | `#e2e8f0` | Slate border / dividers |
| `--color-ink-inverse` | `#ffffff` | Text on navy / blue CTAs |

### Accent

| Token | Value | Psychology / use |
|-------|-------|------------------|
| `--color-accent` | `#2563eb` | Electric Blue - apply CTAs, primary buttons |
| `--color-accent-strong` | `#1d4ed8` | Electric Blue hover / links / wordmark accent |
| `--color-accent-soft` | `#dbeafe` | Soft blue fills / selection |
| `--color-success` | `#059669` | Emerald Green - growth, verified, active hiring, success |
| `--color-success-soft` | `#d1fae5` | Soft emerald backgrounds |
| `--color-warning` | `#f59e0b` | Soft Amber - pending / review / caution highlights |
| `--color-warning-soft` | `#fef3c7` | Soft amber backgrounds |
| `--color-warning-ink` | `#92400e` | Amber text on soft fills |
| `--color-danger` | `#dc2626` | Destructive only (reject, suspend) |

### Usage rules

- **Primary CTAs & links** → Electric Blue  
- **Verified / hired / success** → Emerald Green  
- **Pending review, awaiting action, warnings** → Soft Amber  
- **Body & chrome** → Navy + Slate + White  

Avoid: gold/terracotta career clichés; purple SaaS gradients; broadsheet newspaper layouts; emoji decoration.

## Typography

Rotary International free digital stack (Brand Center / Voice & Visual Identity Guidelines). Licensed Frutiger / Sentinel are not embedded.

| Role | Font | Use |
|------|------|-----|
| Primary | Open Sans · Arial fallback | Headlines, wordmark, navigation, UI, forms, and body copy |

One family for the whole product: regular Open Sans width (not Condensed). We skip Georgia for body so long screens of text stay easy to read — Open Sans / Arial is still Rotary-approved for dense body copy. Contact `graphics@rotary.org` to license Frutiger LT Std / Sentinel if needed for print.

## Motion

1. `rise-in` - hero text entrance  
2. `rise-in` delayed - supporting line + CTAs  
3. `drift` - ambient electric-blue orb on landing

## Layout principles

- Landing hero: brand, one supporting sentence, CTA group, atmosphere - nothing else in the first viewport
- No cards in the hero; list dividers for jobs instead of card grids
- Touch-friendly controls; bottom nav on mobile for role shells
- WCAG 2.1 AA: contrast, labels, focus rings, semantic headings

## UI system (product shells)

Type scale utilities in `app/globals.css`: `text-display`, `text-title`, `text-subtitle`, `text-body`, `text-caption`, `text-overline`. Spacing tokens `--space-1`…`--space-8`. Radius `--radius-sm` / `--radius-md`.

Shared primitives in `components/ui/`:

| Primitive | Use |
|-----------|-----|
| `PageHeader` | Title + breadcrumb + actions |
| `Panel` | Elevated section; `tone="attention"` for pending queues |
| `ListRow` | Directory / queue rows (name-first; IDs secondary) |
| `StatusPill` | Human status labels via `lib/ui/status-labels` |
| `Banner` | Sole feedback channel (no `alert()`) |
| `ReviewWorkbenchFrame` | Detail + sticky action rail |
| `EmptyState` / `LoadingBlock` | Empty and loading |

Job presentation: `JobMetaRow`, `CompanySummaryCard`, `JobPostingBody` in `components/jobs/`.

Shell: candidate / employer use `max-w-5xl`; admin uses `max-w-6xl`. Side nav shows role section label (Member / Employer / Staff).

## Product UX charter

**UI baseline**
- Type, spacing, and status primitives used on every role shell.
- No raw status strings or primary mono IDs in product UI.
- Lists use `ListRow` or shared job cards; details use packet + sticky actions where decisions matter.

**UX baseline**
- Published jobs are discoverable and fully readable with company context.
- Employers always see submitted packets (including `pending_review`).
- Admins act from a readable packet without hunting IDs.
- PWA install works without a store APK; Web Push remains available.

**Growth**
- Saved jobs, richer filters, company brand pages, apply-funnel analytics, taxonomy if productized.
