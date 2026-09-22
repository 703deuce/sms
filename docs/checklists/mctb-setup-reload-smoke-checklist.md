# MCTB — setup reload smoke (≈10 min)

Quick manual checklist. **Not** a substitute for full browser cert on preview.

**URL base:** _______________________  
**SHA:** _______________________

---

## Phone — `/mctb/setup/phone`

- [ ] Page loads with existing values
- [ ] Save (no material bad edits)
- [ ] Hard reload (Ctrl+Shift+R / empty cache)
- [ ] Values identical to before reload

---

## Consent — `/mctb/setup/consent`

- [ ] Select **Ask callers to press 1** (`press_1`)
- [ ] Save
- [ ] Hard reload
- [ ] Still press 1

- [ ] Select **Use permission my business already has** (`existing_consent`)
- [ ] Complete attestation if required; Save
- [ ] Hard reload
- [ ] Still existing_consent

---

## Links — `/mctb/setup/links`

- [ ] Page loads (not 404)
- [ ] Save a trivial change; reload; change persisted

---

## Recovery redirects

- [ ] `/mctb/setup/business-hours` → lands on `/mctb/setup/recovery` (or canonical recovery)
- [ ] `/mctb/setup/follow-up` → recovery (if route exists)
- [ ] `/mctb/setup/schedule` → recovery (if route exists)

---

## Conversations context

- [ ] From MCTB missed call or setup link, open conversation
- [ ] MCTB context preserved (filter / breadcrumb / return path — per product spec)

---

**Smoke overall:** PASS / FAIL — ___________
