# Kirsten Pass 1 — Visual audit screenshot manifest

**Purpose:** Ensure Kirsten receives **MCTB + Voice + shared messaging** captures, not MCTB alone. Voice screens document cross-product visual drift.

**Mode:** Read-only audit inputs. Screenshots are **evidence**, not design authority (see master spec §1).

---

## How to obtain / refresh captures

From a machine that can reach the app (production, staging, or local with auth):

```bash
export UI_AGENT_BASE_URL="https://<your-transovo-host>"
# Optional: DEV_AUTH_BYPASS=1 on target for dev-bypass capture

# Full package (MCTB + Voice)
npx tsx scripts/capture-mctb-voice-visual-audit.ts

# MCTB only
npx tsx scripts/capture-mctb-voice-visual-audit.ts --product mctb

# Voice only
npx tsx scripts/capture-mctb-voice-visual-audit.ts --product voice
```

Default output directory: `/opt/cursor/artifacts/screenshots/visual-audit/` (override with `VISUAL_AUDIT_DIR`).

Deliver to Kirsten: **the full folder** (both `mctb/` and `voice/` subdirectories when using `--product all`), plus any **additional** screenshots already shared out-of-band (Inbox at `/conversations` or `/mctb/conversations`, mobile widths, error states, etc.).

---

## MCTB routes (canonical Pass 1 set)

| File slug (default) | Route | Notes |
|---------------------|-------|--------|
| `mctb_01_overview` | `/mctb` | Overview |
| `mctb_02_missed_calls` | `/mctb/missed-calls` | Missed Calls |
| `mctb_04_inbox` | `/mctb/conversations` | Inbox (MCTB context) |
| `mctb_ai_recovery` | `/mctb/ai-recovery` | Known functional defect in some builds — capture anyway |
| `mctb_05_voicemail` | `/mctb/voicemail` | Operational voicemail |
| `mctb_06_analytics` | `/mctb/analytics` | Analytics |
| `mctb_07_setup_overview` | `/mctb/setup` | Setup overview |
| `mctb_08_setup_phone` | `/mctb/setup/phone` | Phone & Forwarding |
| `mctb_09_setup_missed_call_rules` | `/mctb/setup/missed-call-rules` | Optional if in build; not a permanent nav item |
| `mctb_10_setup_text_back` | `/mctb/setup/text-back` | Text Back |
| `mctb_11_setup_consent` | `/mctb/setup/consent` | Consent |
| `mctb_12_setup_recovery` | `/mctb/setup/recovery` | Recovery |
| `mctb_setup_voicemail` | `/mctb/setup/voicemail` | Setup → Voicemail |
| `mctb_setup_links` | `/mctb/setup/links` | Links |
| `mctb_setup_exclusions` | `/mctb/setup/exclusions` | Exclusions |
| `mctb_setup_test` | `/mctb/setup/test` | Test |

**Also include if available (not in default script batch):**

| Suggested slug | Route |
|----------------|-------|
| `mctb_setup_notifications` | `/mctb/setup/notifications` |
| `shared_inbox` | `/conversations` (global Inbox shell) |

Use `scripts/capture-mctb-setup-notifications-screenshot.ts` or add a one-off Playwright capture for notifications.

---

## Voice / AI Receptionist routes

| File slug (default) | Route | Notes |
|---------------------|-------|--------|
| `voice_01_overview` | `/voice/overview` | Overview |
| `voice_02_calls` | `/voice/calls` | Calls — different visual family vs MCTB |
| `voice_03_receptionist` | `/voice/receptionist` | Receptionist |
| `voice_04_business_knowledge` | `/voice/knowledge` | Business Knowledge |
| `voice_05_call_handling` | `/voice/call-handling` | Call Handling |
| `voice_06_analytics` | `/voice/analytics` | Known functional defect in some builds — capture anyway |

---

## Engagement checklist (for whoever sends Kirsten the package)

1. Attach **master spec:** `docs/KIRSTEN-TRANSOVO-MASTER-VISUAL-AUDIT-AND-DESIGN-SYSTEM-SPEC.md`  
2. Attach **all** screenshots listed above (MCTB + Voice + shared Inbox if separate).  
3. State explicitly: **no implementation** until report sections A–K are reviewed.  
4. Expected deliverable: report per spec §29 + verdict per spec §35.

---

## Master brief

`docs/KIRSTEN-TRANSOVO-MASTER-VISUAL-AUDIT-AND-DESIGN-SYSTEM-SPEC.md`
