#!/bin/bash
# sync.sh - refresh the AgentLab backup snapshot and push it to GitHub as a branch + PR.
# Run on John's box:  ./sync.sh            (pull + sanitize + scan + push + PR)
#                     ./sync.sh pull       (only re-pull into the stage dir)
#                     ./sync.sh scan       (only secret-scan the stage dir)
#                     ./sync.sh push       (only push the stage dir)
# Include/exclude lists live in snapshot.conf (same folder). Needs: ssh key, age, gitleaks, python3, GITHUB_TOKEN in GITHUB_ENV_FILE.
# The server is only READ. Plaintext secrets never touch this box's disk: they stream server -> age -> secrets.tar.age.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/snapshot.conf"
export PATH="$HOME/bin:$PATH"
WORK="${AGENTLAB_BACKUP_WORK:-/home/box/.agentlab_backup/work}"
STAGE="$WORK/stage/$FOLDER"
log(){ echo "[sync $(date +%H:%M:%S)] $*"; }

pull_secrets() {
  command -v age >/dev/null || { echo "age not installed"; exit 1; }
  [ -f "$AGE_RECIPIENT_FILE" ] || { echo "missing recipient file"; exit 1; }
  log "streaming encrypted secrets bundle (ssh -> tar -> age)"
  local list; list="$(printf '%s\n' "${SECRETS_INCLUDE[@]}")"
  # set -o pipefail makes any failure on either side fatal; output only ever written encrypted
  $SERVER_SSH "cd / && tar -czf - --ignore-failed-read $(printf '%s ' "${SECRETS_INCLUDE[@]#/}") 2>/dev/null" \
    | age -R "$AGE_RECIPIENT_FILE" -o "$STAGE/$SECRETS_OUT.tmp"
  mv "$STAGE/$SECRETS_OUT.tmp" "$STAGE/$SECRETS_OUT"
  cp "$AGE_RECIPIENT_FILE" "$STAGE/age-recipient.pub"
  log "secrets bundle: $(stat -c %s "$STAGE/$SECRETS_OUT") bytes (encrypted)"
}

pull_code() {
  rm -rf "$STAGE.new"; mkdir -p "$STAGE.new/server"
  log "pulling code tar from server"
  local inc excd excf
  inc="$(printf '%s\n' "${SERVER_INCLUDE[@]}")"
  excd="$(printf '%s\n' "${EXCLUDE_DIRS[@]}")"
  excf="$(printf '%s\n' "${EXCLUDE_FILES[@]}")"
  # pass the lists as env via a small prelude; script body is piped over the same ssh session
  { printf 'export INCLUDE_LIST=%q EXCL_DIRS=%q EXCL_FILES=%q MAX_KB=%q\n' "$inc" "$excd" "$excf" "$MAX_FILE_KB"; cat "$HERE/server_pull.sh"; } \
    | $SERVER_SSH 'bash -s' > "$WORK/code.tar.gz"
  tar -xzf "$WORK/code.tar.gz" -C "$STAGE.new/server"
  $SERVER_SSH 'bash -s' < "$HERE/server_meta.sh" | tar -xzf - -C "$STAGE.new"
  rm -f "$WORK/code.tar.gz"
  # local docs/code
  for ent in "${LOCAL_INCLUDE[@]}"; do
    src="${ent%%|*}"; dst="${ent##*|}"
    mkdir -p "$STAGE.new/$(dirname "${dst%/}/x")" 
    for g in $src; do [ -e "$g" ] || continue
      case "$dst" in */) mkdir -p "$STAGE.new/$dst"; cp -r "$g" "$STAGE.new/$dst";; *) mkdir -p "$STAGE.new/$(dirname "$dst")"; cp -r "$g" "$STAGE.new/$dst";; esac
    done
  done
  find "$STAGE.new/local" \( -name __pycache__ -o -name '*.pyc' -o -name '*.db' -o -name '*.wav' -o -name '*.mp3' -o -name '*.ogg' -o -name '*.mp4' -o -name '*.env' \) -prune -exec rm -rf {} + 2>/dev/null || true
  find "$STAGE.new" -type f -size +"${MAX_FILE_KB}"k -delete
  # carry over tool files
  for f in README.md apply_report.py crosscheck.py snapshot.conf sync.sh server_pull.sh server_meta.sh push_snapshot.py sanitize.py .gitleaks.toml; do
    [ -f "$HERE/$f" ] && cp "$HERE/$f" "$STAGE.new/$f"
  done
  python3 "$HERE/sanitize.py" "$STAGE.new"
  # swap in (keep previous encrypted bundle until the new one is produced)
  mkdir -p "$STAGE"; rm -rf "$STAGE.old"
  [ -d "$STAGE" ] && mv "$STAGE" "$STAGE.old"
  mv "$STAGE.new" "$STAGE"
  pull_secrets || { rm -rf "$STAGE"; mv "$STAGE.old" "$STAGE"; echo "secrets pull failed; stage restored"; exit 1; }
  rm -rf "$STAGE.old"
  date -u +%Y-%m-%dT%H:%M:%SZ > "$STAGE/SNAPSHOT_TIME_UTC.txt"
  log "stage ready: $(find "$STAGE" -type f | wc -l) files, $(du -sh "$STAGE" | cut -f1)"
}

scan() {
  command -v gitleaks >/dev/null || { echo "gitleaks not installed (see README)"; exit 1; }
  log "gitleaks over stage (excluding encrypted bundle)"
  local rep="$WORK/gitleaks-report.json"; local rc=0
  gitleaks dir "$STAGE" --no-banner --redact -c "$HERE/.gitleaks.toml" -r "$rep" -f json || rc=$?
  if [ -s "$rep" ] && [ "$(python3 -c "import json;print(len(json.load(open('$rep')) or []))")" != 0 ] && [ "${AUTOFIX:-1}" = 1 ]; then
    log "auto-redacting gitleaks-flagged spans, then rescanning"; python3 "$HERE/apply_report.py" "$rep" | sort | uniq -c
    rc=0; gitleaks dir "$STAGE" --no-banner --redact -c "$HERE/.gitleaks.toml" -r "$rep" -f json || rc=$?
  fi
  log "exact-value cross-check against the (in-memory decrypted) secrets bundle"
  age -d -i "$AGE_IDENTITY" "$STAGE/$SECRETS_OUT" | python3 "$HERE/crosscheck.py" "$STAGE" || rc=$?
  log "regex grep for key prefixes (reports file + rule only)"
  python3 "$HERE/sanitize.py" --scan "$STAGE" || rc=$?
  [ $rc -eq 0 ] && log "SECRET SCAN CLEAN" || { log "SECRET SCAN FOUND HITS (see report; fix/redact then rerun)"; return 1; }
}

push() {
  set -a; . "$GITHUB_ENV_FILE"; set +a
  python3 "$HERE/push_snapshot.py" --repo "$REPO" --base "$BASE_BRANCH" --folder "$FOLDER" --stage "$STAGE" --branch-prefix "$BRANCH_PREFIX" ${PUSH_ARGS:-}
}

case "${1:-all}" in
  pull) mkdir -p "$WORK"; pull_code;;
  scan) scan;;
  push) push;;
  all) mkdir -p "$WORK"; pull_code; scan; push;;
  *) echo "usage: $0 [pull|scan|push|all]"; exit 2;;
esac
