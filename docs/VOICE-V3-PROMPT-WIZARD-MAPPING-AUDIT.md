# Voice V3 — Prompt / Wizard / Runtime audit (index)

**Status:** Audit only · **Generated:** 2026-09-19T08:20:19.613Z

The full report was split into smaller files so each part downloads reliably. **All content from the original single file is preserved** (appendix duplicates removed — static Astra core is in part 2).

## Download options

| File | Contents | ~Size |
|------|----------|-------|
| [01-amy-production-prompt.md](./voice-v3-prompt-wizard-audit/01-amy-production-prompt.md) | PART 1 — full Amy/Live instructions + metadata | 12198 B |
| [02-astra-production-prompt.md](./voice-v3-prompt-wizard-audit/02-astra-production-prompt.md) | PART 2 — full Astra instructions + tool contracts | 21523 B |
| [03-compare-wizard-traces-config-knowledge.md](./voice-v3-prompt-wizard-audit/03-compare-wizard-traces-config-knowledge.md) | PARTS 3–7 | 5266 B |
| [04-worksheet-and-gaps.md](./voice-v3-prompt-wizard-audit/04-worksheet-and-gaps.md) | PARTS 8–9 | 8299 B |
| [VOICE-V3-AUDIT.zip](./voice-v3-prompt-wizard-audit/VOICE-V3-AUDIT.zip) | All four parts in one zip | — |
| [VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT-CONDENSED.md](./VOICE-V3-PROMPT-WIZARD-MAPPING-AUDIT-CONDENSED.md) | Worksheet + gaps + path proof **without** full prompt bodies | small |

## Regenerate

`npx tsx scripts/generate-voice-v3-prompt-wizard-audit-doc.ts`

## Quick findings

- V3 Amy = `live-frontend-instructions.ts` (not wizard `instructions.system`).
- Wizard → V3 subset: businessName, timezone, intake schema, first appointment type, Microsoft calendar.
- Knowledge/RAG/Company Brain: saved, **not** on V3 PSTN accept.
- Wizard `agentName` / `openingGreeting`: often **not** on V3 accept (env greeting path).

---

## Production path proof (Voice V3 PSTN)

| Stage | File | Symbol |
|-------|------|--------|
| HTTP | `src/app/api/openai/live/incoming/route.ts` | `POST` → `handleOpenAiLiveIncomingWebhook` |
| Webhook | `src/lib/voice-v3-basic/openai-live-webhook.ts` | `handleOpenAiLiveIncomingWebhook` |
| Config resolve | `src/lib/voice-v3/config/from-published-agent.ts` | `resolveVoiceV3AgentConfigForAgent` |
| Session build | `src/lib/voice-v3-basic/live-session-config.ts` | `buildBasicLiveSession` |
| Amy instructions | `src/lib/voice-v3/prompts/build-voice-v3-prompts.ts` | `buildLiveFrontendInstructions` |
| Astra delegation | `src/lib/voice-v3/intake/delegation-config.ts` | `buildVoiceV3AstraDelegationResponses` |
| OpenAI API | `openai-live-webhook.ts` | `client.live.sessions.accept` |

PSTN: `consumeRecentPstnLeg()` → `workspaceId` / `agentId` for per-agent config.
