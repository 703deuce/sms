# MCTB Production Browser Certification — LIVE EXERCISE

**Production SHA:** 443a46c1c5cbb761801cd1b30196c2ca06bfe224  
**Started:** 2026-09-30T08:23:47.190Z  
**Rule:** Each row = real browser click/fill/toggle (not manifest-only).

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
| /mctb | Overview | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb | Overview | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb | Overview | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Getting Started | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(2)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Analytics | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(6)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Phone & Forwarding | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(11)     - locator  | — | — | — | FAIL — UI |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | General | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Rules | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Getting Started | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(2)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Analytics | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(6)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Phone & Forwarding | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(11)     - locator  | — | — | — | FAIL — UI |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: Needs reply 0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: C6 Caller 6017 (703) 816-6017 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | link: A Anthony Johnson (571) 477-6175 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Consent | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub | Exclusions | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | main | button: Notifications | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | main | button: Add number | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | main | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | main | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | General | button: Add number | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | General | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | General | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Rules | button: Add number | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Rules | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Rules | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Consent | button: Add number | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Consent | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Consent | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Exclusions | button: Add number | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Exclusions | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub | Exclusions | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | link: Edit rules | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | main | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | General | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Rules | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Consent | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | link: Needs reply 0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub | Exclusions | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | button: Notifications | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | button: 1 hour | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | button: Until tomorrow | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | button: 1 week | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | button: Indefinitely | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | button: Save follow-up rules | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | link: Missed calls 0 Today | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | General | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Rules | button: Notifications | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Rules | button: Save rules | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Rules | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Rules | link: Edit rules | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | button: Notifications | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | link: Edit rules | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | link: View consent history | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Consent | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub | Exclusions | button: Notifications | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /onboarding/mctb | Onboarding | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /onboarding/mctb | Onboarding | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /onboarding/mctb | Onboarding | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-calls | Missed Calls | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-calls | Missed Calls | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-calls | Missed Calls | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/conversations | Conversations | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/conversations | Conversations | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/conversations | Conversations | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Messages | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Greeting | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Greeting | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox | Greeting | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/analytics | Analytics | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/analytics | Analytics | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/analytics | Analytics | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/notifications | Notifications | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/notifications | Notifications | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/notifications | Notifications | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Getting Started | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(2)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup | Setup overview | General | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Analytics | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(6)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup | Setup overview | General | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Phone & Forwarding | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(11)     - locator  | — | — | — | FAIL — UI |  |
| /mctb/setup | Setup overview | General | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | General | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Rules | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Rules | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Rules | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Getting Started | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(2)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup | Setup overview | Consent | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Analytics | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(6)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup | Setup overview | Consent | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Phone & Forwarding | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(11)     - locator  | — | — | — | FAIL — UI |  |
| /mctb/setup | Setup overview | Consent | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: Needs reply 0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: C6 Caller 6017 (703) 816-6017 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | link: A Anthony Johnson (571) 477-6175 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Consent | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Exclusions | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Exclusions | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview | Exclusions | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/start | Setup wizard | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/start | Setup wizard | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/start | Setup wizard | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/phone | Setup Phone | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/phone | Setup Phone | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/phone | Setup Phone | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | General | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Rules | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: Needs reply 0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: C6 Caller 6017 (703) 816-6017 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | link: A Anthony Johnson (571) 477-6175 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Consent | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/missed-call-rules | Setup Missed-call rules | Exclusions | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/text-back | Setup Text back | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/text-back | Setup Text back | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/text-back | Setup Text back | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | link: Edit rules | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | General | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Rules | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Rules | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Rules | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | link: Edit rules | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Consent | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Exclusions | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Exclusions | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/consent | Setup Consent | Exclusions | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/notifications | Setup Notifications | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | link: Edit rules | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | General | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Rules | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Rules | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Rules | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Transovo | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Getting Started | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Analytics | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Phone & Forwarding | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | link: Edit rules | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: General | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: Rules | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: Consent | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | tab: Exclusions | live tab | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Consent | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/recovery | Setup Recovery | Exclusions | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Getting Started | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(2)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Analytics | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(6)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Phone & Forwarding | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(11)     - locator  | — | — | — | FAIL — UI |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Messages | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/voicemail | Setup Voicemail | Greeting | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/links | Setup Links | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/links | Setup Links | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/links | Setup Links | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | main | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | main | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | main | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Getting Started | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(2)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Analytics | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(6)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Phone & Forwarding | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(11)     - locator  | — | — | — | FAIL — UI |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | General | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Rules | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | button: Reload | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: link-0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Overview | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Getting Started | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(2)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Missed Calls | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Conversations | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Voicemail | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Analytics | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(6)     - locator r | — | — | — | FAIL — UI |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Missed-Call Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Text Back | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: AI Recovery | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Notifications | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Phone & Forwarding | live link | TimeoutError: locator.click: Timeout 8000ms exceeded. Call log:   - waiting for getByRole('link').nth(11)     - locator  | — | — | — | FAIL — UI |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Settings | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Billing | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Help | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Manage setup | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: Needs reply 0 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: C6 Caller 6017 (703) 816-6017 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | link: A Anthony Johnson (571) 477-6175 | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | combobox: Recovery outcome | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | combobox: Date range | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | combobox: Trigger | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | combobox: Sort | live combobox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | searchbox: searchbox-0 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Consent | searchbox: searchbox-1 | live searchbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | button: Expand sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | button: Collapse sidebar | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/exclusions | Setup Exclusions | Exclusions | button: Blue Ridge Realty (571) 477-6175 | live button | ok | js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/test | Setup Test | main | button: Start test | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup/test | Setup Test | main | link: Fix | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/compliance/consent | Consent log | main | button: Back | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: Copy | live button | ok | js:NotAllowedError: Failed to execute 'writeText' on 'Clipboard': Write permission denied. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: Verizon | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: AT&T | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: T-Mobile | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: Google Voice | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: RingCentral | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: Spectrum | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: Comcast / Xfinity | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: Other | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | button: Back | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/ai-recovery | AI Recovery | main | checkbox: checkbox-0 | live checkbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/phone | Own Sender / Phone | main | button: Back | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/phone | Own Sender / Phone | main | checkbox: checkbox-0 | live checkbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/phone | Own Sender / Phone | main | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/phone | Own Sender / Phone | main | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/numbers | Phone inventory | main | button: Copy | live button | ok | js:NotAllowedError: Failed to execute 'writeText' on 'Clipboard': Write permission denied. | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/numbers | Phone inventory | main | button: Use this number | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/numbers | Phone inventory | main | button: Add another number | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/text-back | Text back (launch) | main | button: Back | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/text-back | Text back (launch) | main | radio: vm-mode | live radio | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/text-back | Text back (launch) | main | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb | Overview (mobile) | 390px | button: Back | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb | Overview (mobile) | 390px | radio: platform-template | live radio | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Press 1 Recommended When you don't answer, the caller hears a short disclosure and presses 1 to receive your fol | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: JessicaRecommended Warm, professional — default receptionist voice | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Play | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Rachel Calm and articulate | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Jade Warm, natural professional | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Talia Warm, soft guide — calm and caring | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Eddie Clear middle-aged male — natural and steady | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Caleb Trusted guide — warm, calm male | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Save voice | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery | Recovery hub (mobile) | 390px | button: Generate audio | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub (mobile) | 390px | button: Publish disclosure | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub (mobile) | 390px | button: I already have consent For businesses that already maintain the required permission to text callers. | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=consent | Recovery hub (mobile) | 390px | checkbox: checkbox-0 | live checkbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub (mobile) | 390px | button: Back | live button | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=exclusions | Recovery hub (mobile) | 390px | link: Settings → Business | live link | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-call-recovery?tab=rules | Recovery hub (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /onboarding/mctb | Onboarding (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /onboarding/mctb | Onboarding (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-calls | Missed Calls (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/missed-calls | Missed Calls (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/conversations | Conversations (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/conversations | Conversations (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/voicemail | Voicemail inbox (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/analytics | Analytics (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/analytics | Analytics (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/notifications | Notifications (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/notifications | Notifications (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview (mobile) | 390px | textbox: textbox-0 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |
| /mctb/setup | Setup overview (mobile) | 390px | textbox: textbox-1 | live textbox | ok | — | — | — | PASS — UI + LIVE EXERCISE |  |

## Summary

```json
{
  "sha": "443a46c1c5cbb761801cd1b30196c2ca06bfe224",
  "routes": 28,
  "rows": 611,
  "exercised": 590,
  "failed": 21,
  "httpErrorSample": [
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Minified React error #418; visit https://react.dev/errors/418?args[]=text&args[]= for the full message or use the non-minified dev environment for full e",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message.",
    "js:Error: Base UI error #31; visit https://base-ui.com/production-error?code=31 for the full message."
  ]
}
```
