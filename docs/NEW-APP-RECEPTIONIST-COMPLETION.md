# Transovo AI Receptionist (`new-app`) — completion checklist

**Last updated:** 2026-10-19  
**Audit:** `docs/NEW-APP-RECEPTIONIST-WIRING-AUDIT.md`  
**Scope:** `/app/receptionist/*` + `AgentProvider` + shared call/knowledge surfaces.

## Product surfaces

| Surface | Route | Backend status |
|---------|-------|----------------|
| Overview | `/app/receptionist` | Mock metrics + partial numbers |
| Calls | `/app/receptionist/calls`, `[id]` | Mock `CALLS` |
| Agent settings | `/app/receptionist/agent` | Mock `AgentProvider` |
| Knowledge | `/app/receptionist/knowledge` | Mock FAQs/gaps/sources |
| Appointments | `/app/receptionist/appointments` | Mock draft only |
| Call handling | `/app/receptionist/call-handling` | Mock draft; partial number picker |
| Test | `/app/receptionist/test` | Simulated |
| Analytics | `/app/receptionist/analytics` | Mock charts |
| Publish | `/app/receptionist/activate` | Simulated publish |

## Engineering checklist

- [ ] `new-app/app/api/receptionist/**` (or ported `solutions/appointment-receptionist`)  
- [ ] `AgentProvider` loads/saves/publishes from API  
- [ ] `AgentConfig` ↔ wizard snapshot mapper in `lib/server/receptionist/`  
- [ ] AI calls list/detail (VoiceCall or unified call DTO)  
- [ ] Knowledge + gaps wired  
- [ ] Analytics wired  
- [ ] Test session + PSTN test wired  
- [ ] Overview routing truth (Ava coverage vs Phone `RoutingSummary`)  
- [ ] Fix calls filter `attention` → `open` (or add alias)  
- [ ] `pnpm test:receptionist` + prod cert script  
- [ ] PSTN validation runbook (§7 of wiring audit)

## Status

**UI shell complete; runtime wiring not started** (same stage Phone was at before `cursor/new-app-phone-stabilization-f350`).
