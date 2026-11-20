#!/bin/sh
set -eu
[ "$#" -eq 1 ] || { echo "Usage: submit.sh JOB_DIR" >&2; exit 2; }
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$HERE/submit.py" "$1"
