#!/usr/bin/env bash
# Copies the shared payments code from the private Stratum-PR/payment_methods repo into the Edge Functions
# that use it, so Supabase deploys don't need registry credentials.
# Usage: PAYMENT_METHODS_DIR=../payment_methods scripts/sync-payment-libs.sh
set -euo pipefail
SRC="${PAYMENT_METHODS_DIR:-../payment_methods}"
(cd "$SRC" && npm run -s build)
for fn in payments; do
  dest="supabase/functions/$fn/lib"
  rm -rf "$dest" && mkdir -p "$dest/athmovil"
  cp "$SRC"/dist/types.js "$SRC"/dist/types.d.ts "$SRC"/dist/money.js "$SRC"/dist/money.d.ts "$dest/"
  cp "$SRC"/dist/athmovil/*.js "$SRC"/dist/athmovil/*.d.ts "$dest/athmovil/"
done
mkdir -p supabase/functions/athm-simulator/lib
cp "$SRC"/simulator/athmovil/core.mjs supabase/functions/athm-simulator/lib/core.mjs
# Local Docker test stack (test-env/): the package's Node simulator server, same core.
cp "$SRC"/simulator/athmovil/core.mjs "$SRC"/simulator/athmovil/server.mjs test-env/ath-simulator/
echo "payments libs synced from $SRC ($(git -C "$SRC" rev-parse --short HEAD))"
