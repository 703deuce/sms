# CI merge gates (updated Nov 14, 2026 8:45 AM ET, per John's build-first rule in TEAM.md)

- **Gate = a passing Coolify build/deploy plus QA's functional PASS on the exact SHA.** If a deploy fails, pull the real Coolify build log, send the exact error to the PR author (or fix it if it's config), redeploy, and continue.
- `new-app-tsc` is only a syntax check on changed files, not a gate on counts.
- Don't block on or chase legacy tsc, voice_v3 pytest, or other reds unrelated to the PR. No CI-config work unless it blocks a build.

Older notes:

- **Formal typecheck gate: `new-app-tsc`**, which checks for no NEW errors vs master (line:col ignored). Root `npx tsc --noEmit` (~17k legacy errors) is NOT a gate and won't be restored.
- `voice-agent-runtime` and `number-marketplace` scoped tsc steps are `continue-on-error` (since #1187); the debt is tracked in https://github.com/703deuce/sms/issues/1188.
- Other gates: the Coolify build passes, a QA PASS on the exact head SHA, and `new-app-guards` and `clips-worker-pytest` are green.
- Pre-existing master reds don't block a merge. CI is currently red only from 4 voice_v3 pytest ImportErrors (`_registered_tool_log_name`), owned by Backend (#1188).
- New test files must be wired into a CI job in the same PR (QA checks this).
