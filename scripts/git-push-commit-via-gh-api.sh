#!/usr/bin/env bash
# Push a single local commit to origin/master via GitHub Git Data API (when git push auth fails).
set -euo pipefail
COMMIT_SHA="${1:?commit sha}"
REPO="${2:-703deuce/sms}"
BRANCH="${3:-master}"

PARENT=$(git rev-parse "${COMMIT_SHA}^")
PARENT_REMOTE=$(gh api "repos/${REPO}/git/commits/${PARENT}" -q .sha 2>/dev/null || true)
if [[ -z "$PARENT_REMOTE" ]]; then
  echo "Parent ${PARENT} not on remote; abort"
  exit 1
fi

BASE_TREE=$(gh api "repos/${REPO}/git/commits/${PARENT}" -q .tree.sha)
mapfile -t FILES < <(git diff-tree --no-commit-id --name-only -r "$COMMIT_SHA")

TREE_ENTRIES=()
for f in "${FILES[@]}"; do
  [[ -z "$f" ]] && continue
  if [[ ! -f "$f" ]]; then
    echo "skip missing $f"
    continue
  fi
  BLOB_SHA=$(gh api "repos/${REPO}/git/blobs" \
    -f encoding=base64 \
    -f content="$(base64 -w0 "$f")" \
    -q .sha)
  TREE_ENTRIES+=("{\"path\":\"${f}\",\"mode\":\"100644\",\"type\":\"blob\",\"sha\":\"${BLOB_SHA}\"}")
done

TREE_JSON=$(printf '%s\n' "${TREE_ENTRIES[@]}" | jq -s '{base_tree:"'"$BASE_TREE"'", tree: .}')
NEW_TREE=$(gh api "repos/${REPO}/git/trees" --input - <<<"$TREE_JSON" -q .sha)

MSG=$(git log -1 --format=%B "$COMMIT_SHA" | jq -Rs .)
COMMIT_JSON=$(jq -n \
  --arg message "$(git log -1 --format=%B "$COMMIT_SHA")" \
  --arg tree "$NEW_TREE" \
  --arg parent "$PARENT_REMOTE" \
  '{message: $message, tree: $tree, parents: [$parent]}')

NEW_COMMIT=$(gh api "repos/${REPO}/git/commits" --input - <<<"$COMMIT_JSON" -q .sha)
gh api -X PATCH "repos/${REPO}/git/refs/heads/${BRANCH}" -f sha="$NEW_COMMIT" -F force=false
echo "Updated ${BRANCH} -> ${NEW_COMMIT}"
