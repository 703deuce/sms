# Voice V2 Phase 2A — Sign-off report

Generated as part of Phase 2A sign-off gates (no Phase 2B).

## 4. Distributed CAS safety (`DISTRIBUTED_CAS_SAFE`)

**Mechanism:** `RedisVoiceV2CallContextStore.patchRecord` and `createRecord` call `RealtimeSessionStore.acquireLock(\`voice-v2-ctx:${canonical}\`)` before read-modify-write.

**Lock properties (from `src/lib/voice/realtime-session/store.ts`):**

| Property | Behavior |
|----------|----------|
| Distributed | Redis `SET key token NX PX ttl` — only one holder across replicas |
| Key-specific | `amy:realtime:lock:voice-v2-ctx:{canonicalSessionKey}` |
| TTL-protected | Default 5000ms; lock auto-expires if holder dies |
| Release | Compare token then `DEL` — does not delete another holder’s lock |

**CAS inside lock:** read record → verify `stateVersion === expectedVersion` → write incremented version → `SET` with TTL.

**Writers outside lock:** Class A mutations must use `patchVoiceV2CallContext` / `store.patchRecord` only. `setVoiceV2CallContext` uses `replacePayload` (same lock). No direct Redis `SET` of context JSON elsewhere.

**In-memory store (tests):** single-process `patchRecord` is atomic within one Node process; not cross-replica.

**Gap:** `persistNewRecordToL2` background path uses `createRecord` which takes lock — safe but not on caller await path after `l2Persist: "background"` change.

## 3. Production L2 fail-closed

`assertVoiceV2SharedSessionBackendAllowed()` in `store-config.ts`:

- `NODE_ENV=production` + no `REDIS_URL` → throws `VoiceV2SharedSessionUnavailableError`
- Tests/local: `VOICE_V2_ALLOW_MEMORY_L2=1` (set by `resetVoiceV2CallContextStoreForTests`)

## 1. First-tool latency

Run: `npx tsx scripts/benchmark-voice-v2-context-init-phase-2a.ts`

- Compares pre-2A (config + L1 only) vs Phase 2A `ensure` with **`l2Persist: "background"`** (no await on L2 create).
- Cold Phase 2A path still includes **one L2 GET** on miss before config load; reported separately.

## 2. Book regression

`test-voice-v2-book-offered-slot-headless.ts`:

- On `microsoft_token_unavailable` (and related env errors), exits 0 with `BOOK_REGRESSION_STATUS=PREEXISTING_ENVIRONMENT_FAILURE` unless `VOICE_V2_HEADLESS_REQUIRE_MICROSOFT=1`.
- Baseline commit `d36ee233` fails identically in this environment.
