# Transovo AI — Voice Agent + Softphone Feature Audit

**Updated:** 2026-08-01 (finish remaining gaps + multi-pass bugfix)  
**Live site:** https://transovo.ai  

## Status meaning (code-complete)

| Label | Meaning |
|-------|---------|
| **Full** | UI + API + runtime path implemented. Live Telnyx number/creds only needed to exercise the path. |
| **External** | Intentionally deferred: native apps, carrier CNAM writeback, third-party spam networks. |

**Customer expectation:** once a Telnyx number is assigned and env is set, checklist features should work without more product wiring.

### Env
`TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_PUBLIC_KEY`, `APP_URL`  
Optional: `TELNYX_TELEPHONY_CREDENTIAL_ID`, `TELNYX_STORAGE_REGION`, Brevo email for voice email tools  
Webhooks: `/api/telnyx/voice`, `/api/telnyx/voice/tools`  
Schema: `npm run db:push` or `supabase/voice-softphone-checklist.sql`

### This pass closed (remaining gaps)
- Softphone merge of held lines into conference
- Call flip to another device + bridge on answer
- Network quality / reconnect UI hints
- Call whisper + inbound call screening gather
- IVR nested submenus + after-hours menus
- Softphone live transcription + AI notes/summary
- Voice TTS preview API + builder Preview button
- Post-call urgency scoring
- Per-recipient timezone (Contact.timezone / customFields / campaign vars)
- Cross-campaign frequency cooldown via callingRules
- Anonymous dial + block caller from softphone
- Queue estimated-wait TTS
- Softphone permission enforcement (record/transfer/whisper/admin/intl)
- Click-to-call opens softphone WebRTC path (`/phone?dial=`) instead of orphaning Call Control media

### Critical bug fixes in this pass
- Warm transfer no longer hangs up consult after bridge
- Queue overflow accepts `forward` alias (UI) in addition to `external`
- Queue member / simultaneous ring / conference / call-flip legs bridge on answer
- `forcedAgentId` honored on softphone → AI forward
- Recording/transcription webhooks no longer mark live AI calls COMPLETED
- Softphone `recordingStartedAt` set on record start
- Park timeout unholds before transfer/voicemail
- AI warm transfer consult speaks summary then scheduled-completes (softphone warm waits for Complete)
- Analytics `humanAnswerRate` excludes voicemail/AMD answers

### Remaining truly external
- Native mobile apps, OS Bluetooth stack (browser handles headsets)
- Carrier CNAM writeback, spam-network feeds

### Product positioning (2026-08-01)
See `docs/PRODUCT_POSITIONING.md`. Phone reliability outranks AI. New launch surfaces:
- `/phone/readiness` — Phone Readiness Test
- `/phone/calls/[id]` — softphone call-path diagnostics for support
- Explicit warm-transfer state copy in the softphone UI

### Closed in finish-five-gaps pass
- Incoming-call web push + multi-device registration (`softphone_devices`, `/api/phone/devices`, SW click → `/phone?incoming=`)
- Unified contact timeline (SMS + softphone + AI voice + voicemail) on contact detail
- Porting status center (timeline, docs checklist, FOC, rejection, temp forward — no auto-complete)
- Voicemail recording attach + Whisper transcription pipeline on `call.recording.saved`
- Billing itemized upcoming estimate + credit ledger + Stripe invoices

Everything else on the customer checklists is implemented in code and ready for number-on testing.
