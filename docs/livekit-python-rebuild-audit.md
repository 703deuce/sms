# LiveKit Python Rebuild — Corrected Sequence (2026-08-21)

## Single runtime rule

| Component | Status |
|-----------|--------|
| **Python worker** `transovo-voice-runtime` | **ONLY** active LiveKit voice implementation |
| **TypeScript** `voice-runtime/` | **REMOVED** — `main.ts` exits immediately; not deployed |
| **Outbound AI voice** | **DISABLED** until rebuilt in Python |
| **In-process TS fallback** | **REMOVED** |

## Active template (Phase A)

All inbound PSTN and browser tests default to:

```
livekit_basic_voice
```

Set explicitly via job metadata, template lab, or `VOICE_ACTIVE_TEMPLATE`.

## Composed receptionist

`transovo_receptionist_v1` status: **COMPOSED_UNVERIFIED**

- **Not** routed for customer traffic
- Blocked unless `ALLOW_COMPOSED_RECEPTIONIST=1` (lab only)
- Enable only after reference templates are **VERIFIED** via real calls

Mark templates VERIFIED with:

```bash
VOICE_VERIFIED_TEMPLATES=livekit_basic_voice,livekit_frontdesk_booking
```

## Verification order (mandatory)

1. **Phase A** — `livekit_basic_voice` → 5–10 real PSTN calls → VERIFIED
2. **Phase B** — `livekit_frontdesk_booking` (FakeCalendar) → VERIFIED
3. **Phase C** — `livekit_warm_transfer` → VERIFIED
4. **Phase D** — `livekit_structured_intake` → VERIFIED
5. **Phase E** — `livekit_hotel_receptionist` → VERIFIED
6. **Phase F** — `livekit_knowledge_rag` → VERIFIED
7. **Compose** — `transovo_receptionist_v1` (requires `ALLOW_COMPOSED_RECEPTIONIST=1`)
8. **50-call matrix** — only after final receptionist is composed and verified

## Dispatch path

```
PSTN → Telnyx FQDN → LiveKit inbound trunk
  → dispatch rule transovo-inbound-dispatch
  → agent transovo-voice-runtime (Python ONLY)
  → bootstrap → resolve_template_id() → livekit_basic_voice (default)
```

## UI / config preserved

`compileReceptionistConfig → receptionistCompiled → compiledPrompt` unchanged.

Customer UI feeds the composed receptionist **only after** reference templates are verified.
