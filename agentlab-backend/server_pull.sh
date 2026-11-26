#!/bin/bash
# Runs ON the server (read-only), streams a tar.gz to stdout. Args come via env from sync.sh.
# usage: SERVER_INCLUDE_LIST, EXCL_DIRS, EXCL_FILES, MAX_KB set by sync.sh (newline separated)
set -u
cd /
prune=(); while IFS= read -r d; do [ -n "$d" ] && prune+=( -o -name "$d" ); done <<<"$EXCL_DIRS"
nf=(); while IFS= read -r f; do [ -n "$f" ] && nf+=( ! -name "$f" ); done <<<"$EXCL_FILES"
paths=(); while IFS= read -r p; do [ -n "$p" ] && for g in $p; do [ -e "$g" ] && paths+=( "${g#/}" ); done; done <<<"$INCLUDE_LIST"
find "${paths[@]}" \( -type d \( -name '__never__' "${prune[@]}" \) -prune \) -o \( \( -type f -o -type l \) -size -"${MAX_KB}"k "${nf[@]}" -print0 \) 2>/dev/null \
 | tar --null --no-recursion -T - -czf - --ignore-failed-read 2>/dev/null
