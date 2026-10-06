# MCTB — certification gate / final freeze

**Product implementation:** FROZEN after reconciliation (`da0712f1` + Stage 2 fix).  
**PR:** https://github.com/703deuce/sms/pull/609

Do not add features, redesign pages, change recovery/suppression, or restore AI Recovery. Work only on **certification blockers**.

---

## Candidate SHAs

| Milestone | SHA | Notes |
|-----------|-----|--------|
| Reconciliation | `da0712f1b9e10c1415afb89f52e0b2818d78a455` | Handled UX, AI Recovery CTAs, tests |
| Stage 2 fix | *(see `git log` on branch after merge)* | Opus weekly schedule editor — **certify deployed SHA, not da0712f1 alone if superseded** |

---

## 1. Stage 2 legacy import (code)

**Fixed:** `mctb-messaging-hours-panel.tsx` now uses `newui-transplant/components/mctb/mctb-weekly-schedule-editor.tsx` (same `MctbWeeklySchedule` / API / persistence). Legacy `components/mctb/weekly-schedule-editor.tsx` re-exports Opus editor.

**Verify locally:**

```bash
npm run verify:mctb-stage2-legacy-imports
npm run verify:mctb-stage2-presentation
npx tsx scripts/test-mctb-deterministic-recovery-launch.ts
npx tsx scripts/test-mctb-schedule-pause.ts
npx tsx scripts/test-mctb-first-text-templates.ts
```

---

## 2. DB/Redis matrix failures — environment only

Do **not** patch production code for these in a DB-less VM:

- `31-bullmq-worker` — Redis
- `9-press1-db` — DATABASE_URL
- `23-platform-sender` — DATABASE_URL
- `28-number-scope` — DATABASE_URL

Re-run in infrastructure-capable environment:

```bash
bash scripts/run-mctb-consolidated-nonhuman-matrix.sh
```

---

## 3. Deploy

Merge/deploy through normal Coolify path. Record **final deployed SHA**. Wait for green build before browser cert.

---

## 4. Production configuration (deployed candidate)

- `MCTB_LEGACY_AI_SMS_REPLY=0`
- `businessReplySms` enabled for cert workspace
- MCTB active, forwarding, sender ready, Press-1, notification recipients (email + SMS), business hours, deterministic Text Back strategy

---

## 5. Browser certification

`docs/MCTB-PRODUCTION-BROWSER-CERTIFICATION.md` + `scripts/mctb-production-browser-cert-exercise-all.ts` on **new SHA**.

Priority: notifications CRUD, analytics (no React #418), Handled, no AI Recovery links for deterministic workspace.

---

## 6. Live PSTN (after browser green)

External handset: BH recovery, AH recovery, duplicate suppression regression, STOP, voicemail (if entitled), owner SMS + **owner SMS isolation**, owner SMS failure behavior where safe.

---

## Final acceptance checklist

- [ ] Stage 2 legacy-import guard PASS
- [ ] Stage 2 presentation guard PASS
- [ ] Consolidated matrix PASS (DB + Redis environment)
- [ ] Current production browser certification PASS
- [ ] Notification recipient CRUD PASS
- [ ] Analytics loads without React #418
- [ ] `MCTB_LEGACY_AI_SMS_REPLY=0` confirmed
- [ ] During-hours PSTN PASS
- [ ] After-hours PSTN PASS
- [ ] One-ack + hard-stop PASS
- [ ] Owner email PASS
- [ ] Owner SMS PASS
- [ ] Owner SMS isolation PASS
- [ ] Duplicate suppression regression PASS
- [ ] STOP PASS
- [ ] Voicemail PASS (if entitled)
- [ ] Needs follow-up → Mark handled → Handled PASS
- [ ] Analytics Handled PASS

**After all checked:** FREEZE MCTB engineering for launch. Subsequent work: certification defect, production defect, compliance, measured evidence, or packaging only.

---

## Related docs

- `docs/MCTB-FINAL-LAUNCH-RECONCILIATION-REPORT.md` — reconciliation pass results
- `docs/MCTB-LAUNCH-MENU-AUDIT.md` — menu audit
