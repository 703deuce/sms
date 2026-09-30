# MCTB Production Browser Certification

**Base URL:** (production — see run env MCTB_PROD_CERT_BASE_URL)  
**Workspace:** ws_1  
**Production SHA (start):** c935c42c537fb5806c10135186c11c513332568b  
**Started:** 2026-09-30T03:57:39.595Z

| Page | Tab | Control | Browser action | UI result | Backend result | Refresh result | Effective runtime | Status | Defect/Fix |
|------|-----|---------|----------------|-----------|----------------|----------------|-------------------|--------|------------|
| Missed-call recovery | general | Pause 1 hour | click 1 hour preset | save OK | recoveryPaused=true pauseKind=timed | active copy still shown | timed | PASS — UI + PERSISTENCE + EFFECTIVE CONFIG |  |
