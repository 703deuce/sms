# MCTB Production Browser Certification — Phase 3b

**Production SHA:** b800c0a206d186c8b32ce11426682112eb002cc9  
**Workspace:** ws_1  
**Started:** 2026-09-30T12:33:39.033Z

Non-product (do not fix in app): Phase 3 sidebar timeouts, clipboard denied, Base UI #31, React #418, superseded Analytics row.

| Route | Page | Tab/Surface | Control | Browser Action | UI Result | Backend Result | Refresh Result | Runtime Result | Status | Defect/Fix |
|-------|------|-------------|---------|----------------|-----------|----------------|----------------|----------------|--------|------------|
| /mctb/notifications | Notifications | 3b | Delete recipient | UI audit | No delete control in production UI (edit via overflow only) | — | — | — | PASS — CAPABILITY-N/A (no browser delete) |  |
| /mctb/notifications | Setup Notifications | 3b | Add recipient | prompt add mctb-browser-cert@transovo.test | row visible | before=0 after=1 certPresent=true post=200 {"data":{"config":{"responseMode":"ai_conversation","emergencyDetectionEnabled":false,"emergencyCriteria":null,"emergenc | pending | mctb_notification_recipients | PASS — UI + PERSISTENCE (3b) |  |
| /mctb/notifications | Notifications | 3b | Edit recipient | — | Edit control not found after add | {"recipientCount":1,"emergencyDetectionEnabled":false,"certRecipientPresent":true,"certRecipientEditedPresent":false} | — | — | FAIL — PRODUCT |  |

## Summary

```json
{
  "sha": "b800c0a206d186c8b32ce11426682112eb002cc9",
  "rows": 3,
  "pass": 2,
  "failProduct": 1,
  "failHarness": 0,
  "productFailures": [
    {
      "route": "/mctb/notifications",
      "control": "Edit recipient",
      "ui": "Edit control not found after add",
      "backend": "{\"recipientCount\":1,\"emergencyDetectionEnabled\":false,\"certRecipientPresent\":true,\"certRecipientEditedPresent\":false}"
    }
  ],
  "harnessFailures": []
}
```
