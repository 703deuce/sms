# MCTB deterministic recovery — audit vs launch checklist

Audit date: 2026-10-05. Branch: `cursor/mctb-first-text-templates-f350`.

| Checklist item | Status | Notes |
|----------------|--------|--------|
| 5 first-message strategies | **Done** | `src/lib/mctb/first-text-templates/registry.ts` |
| Callback expectation `{{callback_time}}` | **Done** | BH + after-hours presets; stored on send in missed-call metadata |
| Information request builder | **Done** | `InformationRequestFieldsEditor`; reuses collect-field schema |
| Dynamic information-request rendering | **Done** | `information-request-phrase.ts` → `{{information_request_phrase}}` |
| Business-hours awareness for messaging | **Partial** | `inMctbBusinessWindow` drives template + callback; copy not fully split per user evening examples |
| Separate after-hours messaging | **Partial** | After-hours callback preset + ack wording; opener bodies share structure |
| First-reply acknowledgment | **Done** | `customer-sms.ts` + `deterministic-inbound-reply.ts` |
| Then automation stops | **Done** | State `resolved`; no further auto SMS unless `MCTB_LEGACY_AI_SMS_REPLY=1` |
| Business notification | **Existing** | `inbound-reply-handoff.ts` (verbatim preview in metadata) |
| Duplicate-call suppression | **Existing** | Recovery Controls / runtime (not changed this pass) |
| Repeat-call indicator | **Existing / verify** | Missed-call events remain separate rows |
| Voicemail reinforces SMS | **Gap** | TeXML/voicemail copy not updated this pass |
| Reply terminates recovery state | **Partial** | Ack + resolved; explicit TEXTED→REPLIED labels in UI TBD |
| Delivery/runtime health | **Existing** | Unchanged |
| Core analytics | **Existing** | Unchanged |
| Template/timing metadata | **Done** | `firstTextTemplateId`, `recoveryCallbackTimePhrase`, etc. on metadata |
| AI Recovery hidden from nav | **Done** | Removed from `mctb-nav.ts`; route preserved |
| AI not on critical path | **Done** | Default deterministic; legacy AI behind env flag |
