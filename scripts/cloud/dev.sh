#!/usr/bin/env bash
# Run the Next.js dev server against the local Supabase-compatible stack.
#
# Cursor Cloud injects real Supabase/Telnyx secrets into the environment and
# those take precedence over .env, so we export the local values explicitly to
# keep development self-contained and avoid touching a shared hosted database.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
cd "$(repo_root)"
use_local_env
exec npm run dev
