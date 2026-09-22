# Voice V3 — automated regression scripts checklist

From restore/cert train (your matrix screenshots). Re-run on **candidate SHA** before PSTN.

**SHA:** _______________________

| Script / area | Pass? |
|---------------|-------|
| [ ] request-only | |
| [ ] knowledge retrieval | |
| [ ] website crawl | |
| [ ] qualification / urgency | |
| [ ] service policy | |
| [ ] booking | |
| [ ] SEND_LINK matrix (14/14) | |
| [ ] transfer | |
| [ ] active-agent demo fallback | |
| [ ] filesearch session cert | |
| [ ] OpenAI ingestion smoke | |

---

## Optional / environment-sensitive

- [ ] Booking persistence DB test (re-run locally with responsive `DATABASE_URL` if remote hung)

---

## Call history (post `ccfa2d3e`)

- [ ] Native transcript validator on real call
- [ ] Telnyx recording → ingest → playback (if recording enabled on test call)
- [ ] `scripts/cert-voice-v3-call-history.ts` with `PLAYBACK_HTTP=1` when applicable

---

## Commands (examples — adjust to repo scripts you use)

```bash
npm run verify:mctb-final-pipeline
# plus project-specific voice-v3 cert scripts from docs/VOICE-V3-CERT-PRE-DEPLOY-GO-NO-GO.md
```

**Regression train overall:** PASS / FAIL — ___________
