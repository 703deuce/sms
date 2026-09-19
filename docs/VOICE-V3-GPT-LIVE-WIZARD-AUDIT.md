# Voice V3 wizard — GPT-Live-1 control audit

Authority: OpenAI GPT-Live-1 session contract (model, instructions, voice, delegation). Legacy Deepgram/Flux/ElevenLabs/Realtime VAD knobs are **not** exposed in the appointment receptionist wizard.

## Classifications

| Category | Meaning |
|----------|---------|
| `LIVE_API_NATIVE` | Maps to a real GPT-Live session field or capability |
| `LIVE_PROMPT_CONTROL` | Customer control compiles into `instructions` |
| `PLATFORM_INTERNAL` | Transovo runtime only (delegation, backend model) |
| `RUNTIME_ONLY` | Append instructions / sideband — not wizard toggles |
| `UNSUPPORTED_LEGACY` | Removed from customer wizard |

## Summary table

See `src/lib/voice-v3/config/gpt-live-wizard-audit.ts` (`GPT_LIVE_WIZARD_AUDIT_TABLE`) for the canonical rows.

Certification: `npx tsx scripts/test-voice-v3-gpt-live-wizard-audit.ts`

## Customer-facing changes (this pass)

- **Removed** from wizard UI: responsiveness, interruption sensitivity, numeric speaking-speed sliders (legacy stack).
- **Added / remapped**: speaking pace, accent, backchannel level, caller pause patience, interruption style → `conversation.livePromptControls` → `# GPT-LIVE CONVERSATION TUNING` in live instructions.
- **Custom voice**: schema + compile path (`telephony.liveVoiceOutput: { id }`); UI gated by `NEXT_PUBLIC_OPENAI_CUSTOM_VOICE_WIZARD=1`.

Leaf manifest count is **not** fixed at 204 — it tracks actual customer-editable controls after legacy removal.
