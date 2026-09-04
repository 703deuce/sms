# Appointments Connected Pages — QA Progress

Resource-constrained certification + Kimi Mode 2 visual fidelity pass.

| Page | Status | Commit | Notes |
|------|--------|--------|-------|
| Overview | NOT TESTED | — | |
| Calendar | NOT TESTED | — | |
| Appointment Types | NOT TESTED | — | |
| Availability | NOT TESTED | — | |
| Reminder Settings | NOT TESTED | — | |
| Booking | NOT TESTED | — | |
| Get Started | NOT TESTED | — | |

## Mode 2 workflow
1. `npx tsx scripts/appointments-kimi-mode2.ts capture` (1 browser, serial, **transovo.ai** by default)
2. `npx tsx scripts/appointments-kimi-mode2.ts kimi` (Kimi jobs may run concurrently)
3. Re-capture + compare after Kimi changes
4. Final build only after all 7 pages pass individual QA

Override base URL only if needed: `UI_AGENT_BASE_URL=$APP_URL`

## Rules
- One Chromium instance for local capture/QA
- No browser QA during production builds
- Commit + update this file after each page checkpoint
