#!/usr/bin/env bash
# Fast-forward push to origin/master; fall back to GitHub Git Data API when git push auth fails.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
BRANCH="${1:-master}"

if git push origin "$BRANCH" 2>/dev/null; then
  echo "[git-push-ff] ok via git push"
  exit 0
fi

HEAD_SHA="$(git rev-parse HEAD)"
if [[ -x "$ROOT/scripts/git-push-commit-via-gh-api.sh" ]]; then
  echo "[git-push-ff] git push failed; using GitHub API for $HEAD_SHA"
  bash "$ROOT/scripts/git-push-commit-via-gh-api.sh" "$HEAD_SHA"
  git fetch origin "$BRANCH"
  exit 0
fi

echo "[git-push-ff] push failed and no API fallback script" >&2
exit 1
