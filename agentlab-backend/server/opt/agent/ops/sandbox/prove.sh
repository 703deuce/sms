#!/bin/bash
# Prove that a job user cannot os.remove another job's file, using a
# throwaway docker run of transovo-agent:1.63.1-full. Does not touch
# the live workspace or restart agent-lab.
set -euo pipefail
IMAGE="${PROOF_IMAGE:-transovo-agent:1.63.1-full}"
PROOF=$(mktemp -d /tmp/agent-sandbox-proof.XXXXXX)
cleanup() { rm -rf "$PROOF"; }
trap cleanup EXIT

mkdir -p "$PROOF/workspace/jobs/job-a" "$PROOF/workspace/jobs/job-b" \
         "$PROOF/workspace/memory/projects" "$PROOF/workspace/skills" \
         "$PROOF/workspace/.helper"
echo "other-job-secret" > "$PROOF/workspace/jobs/job-b/secret.txt"
echo "my-file" > "$PROOF/workspace/jobs/job-a/mine.txt"
echo "memory-should-stay" > "$PROOF/workspace/memory/keep.txt"
chown -R 20001:19998 "$PROOF/workspace/jobs/job-a"
chown -R 20002:19998 "$PROOF/workspace/jobs/job-b"
chmod 0700 "$PROOF/workspace/jobs/job-a" "$PROOF/workspace/jobs/job-b"
chmod 0600 "$PROOF/workspace/jobs/job-a/mine.txt" "$PROOF/workspace/jobs/job-b/secret.txt"
chown -R 19999:19998 "$PROOF/workspace/memory" "$PROOF/workspace/skills"
chmod 0755 "$PROOF/workspace/memory" "$PROOF/workspace/skills"
chmod 0644 "$PROOF/workspace/memory/keep.txt"

# Record the map so helper/job-exec would agree (not required for this proof).
echo "job-a 20001" > /tmp/proof-uid.map
echo "job-b 20002" >> /tmp/proof-uid.map

echo "=== proof workspace ==="
find "$PROOF/workspace" -printf "%m %u %g %p\n"

echo "=== as job-a (uid 20001): write own file (must succeed) ==="
docker run --rm --network none --user 20001:19998 \
  -v "$PROOF/workspace:/workspace" \
  --entrypoint python3 "$IMAGE" -c '
import os, pathlib, sys
p = pathlib.Path("/workspace/jobs/job-a/mine.txt")
p.write_text(p.read_text() + "\nappended-by-job-a\n")
print("WRITE_OWN: ok")
'

echo "=== as job-a (uid 20001): os.remove another job'\''s file (must be denied) ==="
set +e
docker run --rm --network none --user 20001:19998 \
  -v "$PROOF/workspace:/workspace" \
  --entrypoint python3 "$IMAGE" -c '
import os, sys
path = "/workspace/jobs/job-b/secret.txt"
try:
    os.remove(path)
    print("REMOVE_OTHER: unexpected success")
    sys.exit(10)
except PermissionError as e:
    print("REMOVE_OTHER: denied as expected:", type(e).__name__)
    sys.exit(0)
except OSError as e:
    print("REMOVE_OTHER: denied as expected:", type(e).__name__, e)
    sys.exit(0)
'
rc=$?
set -e
if [ "$rc" != 0 ]; then
  echo "PROOF FAILED: os.remove was not denied (exit $rc)" >&2
  exit 1
fi

echo "=== as job-a: also cannot truncate/overwrite the other job file or memory ==="
docker run --rm --network none --user 20001:19998 \
  -v "$PROOF/workspace:/workspace" \
  --entrypoint python3 "$IMAGE" -c '
import sys
fails = []
for path in ("/workspace/jobs/job-b/secret.txt", "/workspace/memory/keep.txt"):
    try:
        open(path, "w").write("pwned")
        print("WRITE", path, "unexpected success")
        fails.append(path)
    except PermissionError:
        print("WRITE", path, "denied as expected")
if fails:
    sys.exit(11)
'

echo "=== victim file still intact ==="
docker run --rm --network none --user 0 \
  -v "$PROOF/workspace:/workspace" \
  --entrypoint cat "$IMAGE" /workspace/jobs/job-b/secret.txt
echo
grep -qx "other-job-secret" "$PROOF/workspace/jobs/job-b/secret.txt"
grep -qx "memory-should-stay" "$PROOF/workspace/memory/keep.txt"
echo "PROOF PASSED"
