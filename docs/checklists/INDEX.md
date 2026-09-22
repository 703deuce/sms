# Transovo checklists — copy-paste index

Open any file below in the repo, select all, copy. These are **checklists** (things to verify), not gap inventories.

**Candidate branch for UI closure:** `cursor/voice-ui-closure-2304`  
**Docs-only reconciled inventory:** branch `cursor/product-ui-gap-reconciled-2304` → `docs/PRODUCT-UI-GAP-INVENTORY-RECONCILED-2026-09-22.md`

| # | File | Use when |
|---|------|----------|
| 1 | [voice-ui-closure-pass-checklist.md](./voice-ui-closure-pass-checklist.md) | Full UI closure pass (steps 0–13) |
| 2 | [voice-pstn-single-call-smoke-checklist.md](./voice-pstn-single-call-smoke-checklist.md) | One real phone call after candidate merge |
| 3 | [voice-pstn-product-cert-checklist.md](./voice-pstn-product-cert-checklist.md) | Full Voice PSTN product cert A–F |
| 4 | [voice-regression-scripts-checklist.md](./voice-regression-scripts-checklist.md) | Automated regression matrix (restore/cert train) |
| 5 | [mctb-setup-reload-smoke-checklist.md](./mctb-setup-reload-smoke-checklist.md) | Quick MCTB save/reload smoke (10 min) |
| 6 | [mctb-browser-cert-priority-rows-checklist.md](./mctb-browser-cert-priority-rows-checklist.md) | Priority MCTB cert IDs to re-run first |
| 7 | [mctb-browser-cert-full-rows-checklist.md](./mctb-browser-cert-full-rows-checklist.md) | Every MCTB browser cert row (Sept 8 baseline + re-test) |
| 8 | [deploy-merge-candidate-checklist.md](./deploy-merge-candidate-checklist.md) | Merge PRs, SHA pin, Google branch, deploy gate |
| 9 | [voice-call-detail-manual-qa-checklist.md](./voice-call-detail-manual-qa-checklist.md) | Browser QA for Calls / Knowledge / test entry |

**Run full MCTB browser cert (automation):**

```bash
npm run cert:appointments-mctb-browser:preflight
# then on preview/staging with CERT_BROWSER_PASSWORD set:
npm run cert:appointments-mctb-browser -- --cert CERT-MCTB
```

**Sept 8 results source (historical only):** `docs/certification/APPOINTMENTS_MCTB_BROWSER_CERT_RESULTS.md`
