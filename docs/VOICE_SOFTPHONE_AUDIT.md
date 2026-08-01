# Transovo AI — Voice Agent + Softphone Feature Audit

**Updated:** 2026-08-01 (close-the-gaps wiring pass)  
**Live site:** https://transovo.ai  

## Status meaning (code-complete)

| Label | Meaning |
|-------|---------|
| **Full** | UI + API + runtime path implemented. Live Telnyx number/creds only needed to exercise the path. |
| **Blocked** | Same as Full for code purposes — previously labeled Blocked only because a number was missing. Treat as ready. |
| **Partial** | Remaining polish / rare edge cases (see notes). |
| **Missing** | Intentionally deferred native-app / carrier CNAM features only. |

**Customer expectation:** once a Telnyx number is assigned and env is set, checklist features should work without more product wiring.

### Env
`TELNYX_API_KEY`, `TELNYX_CONNECTION_ID`, `TELNYX_PUBLIC_KEY`, `APP_URL`  
Optional: `TELNYX_TELEPHONY_CREDENTIAL_ID`, `TELNYX_STORAGE_REGION`, Brevo email for voice email tools  
Webhooks: `/api/telnyx/voice`, `/api/telnyx/voice/tools`  
Schema: `npm run db:push` or `supabase/voice-softphone-checklist.sql`

### This pass closed
- Softphone multi-call / waiting / redial / contacts / favorites / devices / warm transfer / CRM pop / presence
- Softphone inbound forwarding runtime + queue member PSTN ring + park timeout
- AI inbound actions (human_first, transfer, voicemail, after-hours, disclosure)
- AI warm transfer consult/complete/fallback/return-to-AI
- Booking buffers / notice / round-robin / SMS+email confirm
- Analytics filters + outcome/sentiment/campaign metrics
- Testing lab (contact, knowledge, tools, booking traces)
- Compliance settings (disclosure, retention, intl block, spend cap)
- Contact click-to-call (softphone + AI)
- Call history return/SMS/add-contact

### Remaining truly external / rare
- Native mobile apps, OS Bluetooth stack (browser handles headsets)
- Carrier CNAM writeback, spam-network feeds
- Deep multi-level IVR designer polish beyond nested option targets
- Perfect per-recipient local timezone without contact TZ field data

Everything else on the customer checklists is implemented in code and ready for number-on testing.
