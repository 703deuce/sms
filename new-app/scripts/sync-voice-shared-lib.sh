#!/usr/bin/env bash
# Sync legacy monolith voice/receptionist libs into new-app for production build.
# Source of truth remains src/lib; new-app consumes copies (like ../prisma).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${ROOT}/src/lib"
DEST="$(cd "$(dirname "$0")/.." && pwd)/lib"

if [[ ! -d "${SRC}/solutions/appointment-receptionist" ]]; then
  echo "[sync-voice-shared-lib] ERROR: missing ${SRC}/solutions/appointment-receptionist"
  exit 1
fi

echo "[sync-voice-shared-lib] syncing receptionist + voice wizard libs from monorepo src/lib"

copy_tree() {
  local rel="$1"
  rm -rf "${DEST}/${rel}"
  mkdir -p "$(dirname "${DEST}/${rel}")"
  cp -a "${SRC}/${rel}" "${DEST}/${rel}"
}

copy_tree "solutions/appointment-receptionist"
copy_tree "voice-receptionist-wizard"
copy_tree "receptionist-wizard"

mkdir -p "${DEST}/voice" "${DEST}/voice-v3-basic"
for f in load-agent-config.ts gpt-live-file-search-rag.ts; do
  cp -a "${SRC}/voice/${f}" "${DEST}/voice/${f}"
done
cp -a "${SRC}/voice-v3-basic/openai-client.ts" "${DEST}/voice-v3-basic/openai-client.ts"

if [[ -d "${SRC}/voice/runtime-provider" ]]; then
  copy_tree "voice/runtime-provider"
fi

KNOW="${DEST}/server/voice-v3/knowledge"
mkdir -p "${KNOW}"
for f in resolve-agent-knowledge-retrieval.ts resolve-document-source-ids.ts; do
  cp -a "${SRC}/voice-v3/knowledge/${f}" "${KNOW}/${f}"
done

# new-app uses lib/server/db and lib/server/voice-v3
while IFS= read -r -d '' f; do
  sed -i \
    -e 's|@/lib/db"|@/lib/server/db"|g' \
    -e "s|@/lib/db'|@/lib/server/db'|g" \
    -e 's|@/lib/voice-v3/|@/lib/server/voice-v3/|g' \
    "$f"
done < <(find "${DEST}/solutions" "${DEST}/voice-receptionist-wizard" "${DEST}/receptionist-wizard" "${DEST}/voice-v3-basic" "${DEST}/voice/load-agent-config.ts" "${DEST}/voice/gpt-live-file-search-rag.ts" "${DEST}/voice/runtime-provider" "${KNOW}" -type f \( -name '*.ts' -o -name '*.tsx' \) 2>/dev/null | tr '\n' '\0')

echo "[sync-voice-shared-lib] complete"
