# Voice V3 product visibility (launch freeze)

Voice V3 remains **enabled** in the codebase and runtime. For the initial MCTB-only commercial launch, Voice is **not customer-visible** in navigation and ordinary UI entry points.

## Registry

**Source of truth:** `src/lib/products/launch-product-availability.ts`

| Field | Meaning |
|--------|---------|
| `enabled` | Product/runtime exists (entitlements, APIs, workers, routes). **Do not** use this to shut down webhooks, LiveKit, SIP, or post-call jobs. |
| `customerVisible` | Ordinary customers discover the product in nav, switcher, and may browse customer UI routes (when entitled). |

Default launch posture (`LAUNCH_PRODUCT_AVAILABILITY`):

| Product | enabled | customerVisible |
|---------|---------|-----------------|
| mctb | true | true |
| voice | true | **false** |
| appointments | true | false |
| mass_sms | true | false |
| fax | true | false |

Related lifecycle map (marketing/deferred labels): `src/lib/products/v1-product-status.ts` (`ai_receptionist: deferred`).

Platform chrome flag: `VOICE_PRIMARY_LAUNCH = false` in `src/lib/workspace/platform-launch.ts` (MCTB is primary; `MCTB_V1_PRIMARY = true`).

## Navigation and discovery surfaces

These consume `isVoiceProductCustomerVisible()` or `voiceCustomerHiddenRedirect()`:

| Surface | File | Behavior when Voice hidden |
|---------|------|----------------------------|
| MCTB sidebar (AI Receptionist group) | `src/lib/products/mctb-nav.ts` | No Calls / Receptionist / Knowledge / Voice analytics links |
| MCTB mobile bottom nav | `src/lib/products/mctb-nav.ts` | No “Calls” tab |
| Product shell switcher | `src/lib/products/product-shell.ts` | `ai_after_hours` shell omitted from `visibleProductShells` |
| Resolve sidebar by shell | `src/lib/products/resolve-product-nav.ts` | `ai_after_hours` shell falls back to MCTB nav |
| AI After Hours entitlement UI | `src/lib/products/ai-after-hours.ts` | Treated as not entitled for chrome |
| Call handling switcher (MCTB ↔ Voice) | `src/lib/call-handling/show-switcher.ts` | Hidden |
| New UI transplant sidebar | `src/newui-transplant/lib/nav.ts` | Filters out “AI Receptionist” section |
| New UI logo home link | `src/newui-transplant/components/app/app-sidebar.tsx` | Links to `mctbLaunchCustomerHome()` |
| Post-login default | `src/lib/products/routing.ts` | MCTB home when `isMctbV1Primary()` and MCTB customer-visible |

**Not removed:** Shared routes (Numbers, Integrations, Settings, Billing, Conversations/Inbox when entitled, compliance, Microsoft connections).

**Legacy voice nav builder** (`src/lib/products/voice-nav.ts`) is unchanged — used only when legacy voice shell is active, not for MCTB-primary launch chrome.

## Direct route protection (customer UI only)

**Function:** `voiceCustomerHiddenRedirect(pathname)` in `launch-product-availability.ts`

**Wired in:** `src/lib/products/access-guards.ts` → `productAccessDeniedRedirect` → `src/middleware.ts`

When Voice is not customer-visible:

- Paths under `MCTB_BUNDLED_AI_RECEPTIONIST_PATH_PREFIXES` (`src/lib/products/mctb-bundled-receptionist-paths.ts`) redirect to **`/mctb`** (via `mctbShellHome()`).
- Legacy platform home `/dashboard` redirects to **`/mctb`** when `MCTB_V1_PRIMARY` is on.

Ordinary customers who paste `/voice/receptionist` (or other bundled paths) get a clean redirect — not a blank page or 500.

**Explicitly not gated:** `/api/*`, Telnyx/LiveKit webhooks, worker callbacks, SIP ingress, post-call pipelines, provider tool endpoints.

## Internal / QA access

Production customers must **not** use URL query bypasses.

| Mechanism | Use |
|-----------|-----|
| `TRANSOVO_VOICE_CUSTOMER_VISIBLE=1` | Staging/internal deploy: restore Voice in nav and allow bundled `/voice/*` UI |
| `TRANSOVO_VOICE_CUSTOMER_VISIBLE=0` | Force hidden even if default changes |
| `TRANSOVO_VOICE_CUSTOMER_VISIBLE_DEV=1` | Only when `DEV_AUTH_BYPASS` is enabled — local Cloud Agent / dev UI work |

Entitlements (`hasVoice`) are unchanged; hiding is **launch visibility**, not deleting workspace Voice data or runtime.

## Restoring Voice for customers

1. Set `LAUNCH_PRODUCT_AVAILABILITY.voice.customerVisible` to `true` **or** deploy with `TRANSOVO_VOICE_CUSTOMER_VISIBLE=1` for staged QA.
2. Optionally set `VOICE_PRIMARY_LAUNCH = true` if Voice should own default post-login again (coordinate with `routing.ts` / `productHomePath`).
3. Register Voice in the future product switcher using the same registry (`visibleProductShells` already keys off `isVoiceProductCustomerVisible()`).
4. Re-run PSTN / static certification from `docs/VOICE-V3-STATIC-LAUNCH-GATE-CERTIFICATION.md` before commercial Voice launch.

No component deletion or nav reconstruction should be required.

## Future product switcher

`shouldShowProductSwitcher()` (`product-shell.ts`) counts shells from `visibleProductShells()`. When Voice becomes customer-visible and the workspace has AI After Hours entitlement, `ai_after_hours` re-enters the switcher list. MCTB and Voice keep separate nav trees (`mctb-nav` vs voice/receptionist routes) — the switcher only changes **shell context**, matching the intended multi-product model.

## Tests

- `npx tsx scripts/test-launch-product-availability.ts`
- `npx tsx scripts/test-mctb-nav-ia.ts` (launch posture: no AI Receptionist group)
- `npx tsx scripts/test-multi-product-architecture.ts` (post-login and hidden-route redirects; partial legacy voice-nav assertions may still reflect pre-freeze inventory)

## Voice runtime

This freeze pass does **not** modify Voice V3 runtime, LiveKit workers, GPT-Live bridge, wizard compiler, or telephony handlers. Certification restart point: `docs/VOICE-V3-STATIC-LAUNCH-GATE-CERTIFICATION.md` on branch `cursor/voice-v3-runtime-gap-close-2304`.
