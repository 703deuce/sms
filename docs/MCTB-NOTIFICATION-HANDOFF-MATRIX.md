# MCTB notification & handoff matrix

| Trigger | Handoff destination (mode) | Alert channels | Backend handler | Result | Failure |
|---------|---------------------------|----------------|-----------------|--------|---------|
| Customer SMS reply | `responseMode` in config | routingMatrix.caller_replied + recipients | `processMctbInboundReply` | Conversation state + optional notifications | quiet hours suppress |
| Lead captured | same | routingMatrix.lead_captured | guided/AI paths → `deliverMctbHandoffNotifications` | Team SMS/email/in-app | provider errors logged |
| Callback requested | emergencyAction may create callback | routingMatrix.callback_requested | callback-requests service + notify | CallbackRequest row | entitlement 403 |
| Urgent detected | emergencyAction | routingMatrix.urgent_detected | urgency assess + notify | urgent state | — |
| Human required | immediate_handoff / escalate | routingMatrix.human_required | AI ESCALATE_HUMAN | needs_human state | — |
| Test notification | n/a | lead_captured matrix | POST test_notification | test delivery audit | API error |

Modes:

| Mode | Runtime behavior |
|------|------------------|
| notify_only | Save reply, notify team |
| guided_collection | Ask configured fields, then notify |
| ai_conversation | John LLM loop until escalate |
| immediate_handoff | Stop automation, alert on first reply |
