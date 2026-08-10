#!/usr/bin/env bash
# Guardrail: UI pages/components must not import the Firestore client SDK.
# Mutation DAL modules under lib/dal may still touch Firestore for writes.
# Allowed FS reads: mutation helpers, Admin session/privileged APIs, Cloud Functions.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

hits="$(
  rg -n "from [\"']firebase/firestore[\"']" "$ROOT/app" "$ROOT/components" \
    --glob '!**/node_modules/**' || true
)"

if [[ -n "$hits" ]]; then
  echo "Direct Firestore SDK imports found under app/ or components/:"
  echo "$hits"
  echo "UI reads must use RTDB DAL helpers (lib/dal/*-rtdb.ts or wrappers that call them)."
  exit 1
fi

# Flag accidental list/get helpers that still query Firestore for UI-facing lists.
legacy="$(
  rg -n "getDocs\(|collection\(getClientFirestore" \
    "$ROOT/lib/dal" \
    --glob '*-rtdb.ts' \
    --glob '!**/node_modules/**' || true
)"
if [[ -n "$legacy" ]]; then
  echo "Unexpected Firestore queries inside *-rtdb.ts modules:"
  echo "$legacy"
  exit 1
fi

echo "OK: no direct Firestore client imports in app/components UI layers."
echo "Documented FS read exceptions: lib/dal mutations, app/api/** Admin SDK, functions/."
