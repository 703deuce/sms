# Deploy & merge — candidate SHA checklist

Use before promoting past production `4f5e99e4` or running PSTN smoke.

---

## Merge queue

- [ ] Review PR #475 — Voice UI closure (`cursor/voice-ui-closure-2304`)
- [ ] Review PR #474 — Reconciled gap inventory doc (optional docs)
- [ ] Merge UI closure to `master` (or release branch)
- [ ] Record **final candidate SHA**: _______________________

---

## Google V3 (separate from UI)

- [ ] Decision: merge `cursor/voice-v3-google-calendar-2304` @ `02fc3415` before Google PSTN cert?
- [ ] If yes: dedicated PR; run `scripts/test-voice-v3-google-calendar-provider.ts`
- [ ] If no: skip Google booking in PSTN cert B

---

## Pre-deploy

- [ ] `npm run cert:appointments-mctb-browser:preflight` PASS
- [ ] Voice regression scripts checklist complete
- [ ] Coolify: pin image to candidate SHA
- [ ] `prisma migrate deploy` on target env (if migrations pending)
- [ ] Web + voice worker both on same SHA
- [ ] `/api/health` `commitSha` matches candidate

---

## Post-deploy (before calling production “done”)

- [ ] MCTB setup reload smoke OR full browser cert on preview
- [ ] Voice PSTN single-call smoke
- [ ] Voice PSTN product cert A–F (as needed)
- [ ] Call detail: no fake operational fields on real call
- [ ] Recording E2E if recording enabled on test line

---

## Explicitly not required for UI closure

- [ ] Freshness / prompt / filler optimization
- [ ] Mass SMS nav / campaigns
- [ ] R-05 seven-day forward alert (unless backend added)

**Go for production PSTN sign-off:** YES / NO — ___________
