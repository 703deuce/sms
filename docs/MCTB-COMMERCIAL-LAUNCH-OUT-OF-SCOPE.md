# MCTB commercial launch — explicitly out of scope

These items must **not** block `MCTB_COMMERCIAL_LAUNCH_CERTIFICATION` or `MCTB_END_TO_END_FUNCTIONALITY`.

## `test:mctb-timeout-retry-voice-hardening`

**Classification:** `OUT_OF_SCOPE_MCTB_COMMERCIAL_CERTIFICATION`

**Reason:** Asserts Voice V3 / Caller Amy durable booking tool behavior (`VOICE_FAST_TOOL_RESPONSE`, `VOICE_NO_LONG_PROVIDER_WAIT` in `src/lib/voice/tools/builtin-actions.ts`). That path is unrelated to the frozen MCTB commercial TeXML ingress (`mctb_texml_final_v1`), Press-1 / existing-consent SMS recovery, or Opus Stage 2 launch surfaces.

**Policy:** Do not modify Voice V3 booking/durable-operation code as part of the MCTB commercial launch pass. Record this test as out of scope in CI/guard documentation; MCTB guards use `scripts/run-mctb-commercial-launch-guards.sh` and `scripts/run-mctb-commercial-launch-certification.sh` instead.
