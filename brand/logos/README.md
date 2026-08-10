# Brand logos

## Layout

| Path | Purpose |
|------|---------|
| `originals/` | Source PNG/ICO — do not delete |
| `*.webp` (this folder) | Master WebP conversions |
| `/public/brand/*.webp` | Runtime assets served by Next |

## Assets

| File | Notes |
|------|--------|
| `mark-circle` | Handshake circle — **primary** UI mark |
| `wordmark-full` | Full ROTA + SAMBANDH lockup (dark bg) — kept for future marketing |
| `wordmark-compact` | Tiny lockup — low-res; prefer circle + text in UI |

UI chrome uses **circle mark only** (`/brand/mark-circle.webp`) plus the text wordmark in `components/brand/logo.tsx`.
