# Voice V3 — full PSTN product certification (A–F)

From `docs/VOICE-V3-PRODUCTION-DEPLOYMENT-REPORT.md` §6–11. Human PSTN only.

**Deploy SHA under test:** _______________________

---

## A. Microsoft booking

- [ ] PSTN call; natural conversation; book one slot
- [ ] Provider calendar shows event
- [ ] Durable DB: call + appointment linkage
- [ ] No duplicate bookings / side effects

---

## B. Google booking

- [ ] **Prerequisite:** Google V3 dispatch merged to candidate (`02fc3415` branch) if testing Google on `master`
- [ ] PSTN call; book on Google-connected workspace
- [ ] Provider calendar shows event
- [ ] Durable persistence verified

---

## C. REQUEST_ONLY

- [ ] PSTN call; request-only strategy
- [ ] `submit_appointment_request` path completes
- [ ] Staff-visible request / notification as designed

---

## D. FileSearch / knowledge

- [ ] Ask factual question answered from indexed business knowledge
- [ ] Not stuffed-only prompt; runtime retrieval used

---

## E. SEND_LINK

- [ ] PSTN or scripted path sends booking link
- [ ] SMS delivered; link works
- [ ] Matrix scripts 14/14 already passed at cert SHA (re-run if candidate changed)

---

## F. Transfer

- [ ] Transfer attempted per configured plan
- [ ] Caller experience acceptable; exhausted path documented if applicable

---

## Cross-cutting

- [ ] Conversation feels natural (no robotic regression)
- [ ] No duplicate SMS / duplicate book side effects
- [ ] Forensics acceptable for support (internal only)

**Overall PSTN product cert:** PASS / FAIL — ___________
