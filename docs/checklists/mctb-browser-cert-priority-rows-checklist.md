# MCTB browser cert — priority rows (re-test on current SHA)

**Sept 8 baseline** is in `docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md`.  
Re-run on preview; mark **CURRENT** column. Do not assume Sept FAIL is still true.

**Current SHA:** _______________________  
**Cert run date:** _______________________

| ID | Sept 8 | CURRENT (PASS / FAIL / STALE / BLOCKED) | Notes |
|----|--------|----------------------------------------|-------|
| [ ] MCTB-05 | FAIL phone reload | | `/mctb/setup/phone` |
| [ ] MCTB-08 | FAIL Press-1 diagnostics | | |
| [ ] MCTB-09 | FAIL consent persist | | |
| [ ] MCTB-10 | FAIL consent persist | | |
| [ ] MCTB-13 | FAIL links 404 | | |
| [ ] MCTB-14 | FAIL invalid token | | |
| [ ] MCTB-19 | FAIL timeout | | |
| [ ] MCTB-20 | FAIL recovery redirect | | |
| [ ] MCTB-22 | FAIL timeout | | |
| [ ] MCTB-29 | FAIL no fixture | | seed vs STALE |
| [ ] MCTB-31 | FAIL 404 | | |
| [ ] MCTB-32 | FAIL 404 | | |
| [ ] MCTB-33 | FAIL 404 | | |
| [ ] MCTB-34 | FAIL 404 | | |
| [ ] MCTB-35–38 | FAIL notifications 404 | | |
| [ ] MCTB-41–42 | FAIL 404 | | |
| [ ] MCTB-43–44 | FAIL notifications 404 | | |
| [ ] MCTB-46 | FAIL 404 | | |
| [ ] MCTB-48 | FAIL links 404 | | |
| [ ] MCTB-49 | FAIL timeout | | |
| [ ] MCTB-57 | FAIL conversations redirect | | |
| [ ] MCTB-57-business-hours | FAIL recovery redirect | | |
| [ ] MCTB-57-follow-up | FAIL recovery redirect | | |
| [ ] MCTB-57-voice-conversations | FAIL redirect | | |

---

## Blocked (carrier / live)

| ID | Sept 8 | CURRENT |
|----|--------|---------|
| [ ] MCTB-05-live-verify | BLOCKED LIVE PSTN | |
| [ ] (other LIVE PSTN / MEDIA rows) | | |

---

## Intentionally deferred (do not fail product on these)

- [ ] MCTB-17 Local 10DLC Sender
- [ ] MCTB-18 Dedicated Text Number Voice Behavior
- [ ] MCTB-21 Optional One-Time Follow-Up
