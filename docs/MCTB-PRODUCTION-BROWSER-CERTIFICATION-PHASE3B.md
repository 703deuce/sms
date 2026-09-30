# MCTB Production Browser Certification — Phase 3b

**Production SHA:** 443a46c1c5cbb761801cd1b30196c2ca06bfe224  
**Workspace:** ws_1  
**Started:** 2026-09-30T12:07:11.276Z

Non-product (do not fix in app): Phase 3 sidebar timeouts, clipboard denied, Base UI #31, React #418, superseded Analytics row.

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
| /mctb/notifications | Notifications | 3b | Delete recipient | UI audit | No delete control in production UI (edit via overflow only) | — | — | — | PASS — CAPABILITY-N/A (no browser delete) |  |
| /mctb/notifications | Setup Notifications | 3b | Add recipient | prompt add mctb-browser-cert@transovo.test | row missing | before=0 after=0 certPresent=false post=200 {"data":{"config":{"responseMode":"ai_conversation","emergencyDetectionEnabled":false,"emergencyCriteria":null,"emergenc | pending | mctb_notification_recipients | FAIL — PRODUCT |  |
| /mctb/notifications | Notifications | 3b | Edit recipient | — | Edit control not found after add | {"recipientCount":0,"emergencyDetectionEnabled":false,"certRecipientPresent":false,"certRecipientEditedPresent":false} | — | — | FAIL — BLOCKED |  |

## Summary

```json
{
  "sha": "443a46c1c5cbb761801cd1b30196c2ca06bfe224",
  "rows": 3,
  "pass": 1,
  "failProduct": 1,
  "failHarness": 0,
  "productFailures": [
    {
      "route": "/mctb/notifications",
      "control": "Add recipient",
      "ui": "row missing",
      "backend": "before=0 after=0 certPresent=false post=200 {\"data\":{\"config\":{\"responseMode\":\"ai_conversation\",\"emergencyDetectionEnabled\":false,\"emergencyCriteria\":null,\"emergenc"
    }
  ],
  "harnessFailures": []
}
```
