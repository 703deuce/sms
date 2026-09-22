# Voice — single PSTN call smoke (copy-paste)

Use **after** merging UI closure candidate. One call certifies recording + call detail UX.

```
Workspace ID: _______________________
Business line called: _______________
Deploy SHA (from GET /api/health commitSha): _______________
Date/time (UTC): _______________________
Tester phone: _______________________
```

---

## Before the call

- [ ] Candidate branch merged; app deployed to staging or prod target you intend to certify
- [ ] `/api/health` `commitSha` matches expected final SHA
- [ ] MCTB not required for this smoke (Voice-only)

---

## During the call (≈5–8 min)

- [ ] Call the **business number** (not hidden ingress)
- [ ] AI answers; have one natural question (hours, service area, or similar)
- [ ] Complete **one** intent you care about this week:
  - [ ] Microsoft book
  - [ ] Request-only (`submit_appointment_request`)
  - [ ] Send booking link
  - [ ] Transfer
  - [ ] Callback
- [ ] Hang up naturally
- [ ] Wait **2 minutes** for post-call pipeline

---

## Admin UI — `/voice/calls`

- [ ] Open latest call from list
- [ ] **No** fake `$0.15`, **no** fake `Twilio`, **no** mock activity list on real call
- [ ] Activity feed shows customer-meaningful events (or honest empty state)
- [ ] Transcript: READY with segments, or honest PROCESSING / UNAVAILABLE
- [ ] Summary: READY text, or honest PROCESSING / UNAVAILABLE
- [ ] Recording: plays if READY; otherwise honest processing/unavailable (not whole page broken)
- [ ] Contact: name / phone / email when collected

---

## Optional DB spot-check

- [ ] `VoiceCall` row exists for call
- [ ] If booked: `appointmentBooked` or appointment row as expected
- [ ] If recording cert: `VoiceRecording` row + playback URL works

---

## Result

- [ ] **PASS** / **FAIL**: _______
- [ ] Notes: _______________________________________________
