# Voice V3 → LiveKit — cutover rollback boundary (Phase 0)

**Purpose:** Record known-good state before modifying Voice V3 runtime for LiveKit.  
**Directive:** `docs/VOICE-V3-LIVEKIT-IMPLEMENTATION-DIRECTIVE.md`  
**Discovery:** `docs/VOICE-V3-LIVEKIT-INFRA-DISCOVERY.md`

Do **not** delete the direct-OpenAI Voice V3 runtime until LiveKit PSTN certification passes. Rollback = Git revert + Telnyx routing restore.

---

## Git

| Item | SHA / value |
|------|-------------|
| **Recorded at (UTC)** | 2026-09-19T23:41:00Z |
| **Branch** | `master` |
| **Master / repo HEAD at record** | `1aef0e0fd5d4b9b7de3f39a34341c542718e4ab0` |
| **Production `/api/health` commitSha** | `1aef0e0fd5d4b9b7de3f39a34341c542718e4ab0` |
| **Voice V3 direct-OpenAI freshness-certified merge** | `3d3d14eeabdee819329559b1016a1c5a43aad783` (conversation freshness on direct path; business layer unchanged for LiveKit adapter) |

---

## Production deployment identity

| Item | Value |
|------|--------|
| Coolify web app UUID | `ds8s3hjin60qs6g7s0iqkixs` |
| Example container (refresh after deploy) | `ds8s3hjin60qs6g7s0iqkixs-*` |
| Primary URL | See Coolify primary web application public hostname |

---

## +15717491060 Telnyx routing (at record — read-only verify)

**Cert DID:** `+15717491060`  
**Workspace (verify script default):** `ws_1`  
**Agent id (571 script default):** `cmsdkcnwr5p3i5s0h3i1x0j60`

| Check | State at record |
|--------|-----------------|
| Telnyx connection | **Transovo Voice V3 Basic OpenAI SIP** (`3051313082853754271`) — **direct OpenAI SIP**, not LiveKit FQDN |
| LiveKit inbound trunk owns DID | **No** — trunk does not list `+15717491060` in discovery VM verify |
| Telnyx FQDN vs LiveKit Inbound | **Mismatch** — number not on `Transovo LiveKit Inbound` connection |
| Intended cutover | Route DID to **existing** LiveKit Cloud SIP ingress + dispatch to V3 worker profile (exact change documented in Phase 53 pre-PSTN report) |

Re-run before cutover:

```bash
PHONE_E164=+15717491060 \
NODE_OPTIONS='--import ./scripts/preload-server-only.mjs' \
npx tsx scripts/verify-571-livekit-callable.ts
```

---

## Old vs new runtime (single DID rule)

- **Old:** Telnyx → OpenAI Live SIP → sideband/delegation in `transovo-web` (`voice-v3-basic`).
- **New (target):** Telnyx → existing LiveKit Cloud → `transovo-voice` GPT-Live profile → Transovo V3 adapter.
- **Never:** both paths active for the same DID simultaneously.

---

## Secrets

No API keys, LiveKit secrets, or internal API keys are stored in this document.
