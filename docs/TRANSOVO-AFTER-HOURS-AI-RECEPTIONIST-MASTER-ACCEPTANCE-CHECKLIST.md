# Transovo After-Hours AI Receptionist — Master Functional Acceptance Checklist

**Status:** Master definition of “the product works.”  
**Product:** After-Hours AI Receptionist (Voice V3 + published wizard → GPT-Live + Astra).  
**Rule:** Check items **only** when the complete real-world path is wired through V3 and proven end-to-end.

A feature is **not** complete merely because:

- the wizard contains the setting;
- the setting saves to the database;
- the V3 compiler maps it;
- Amy/Astra receives it;
- a backend function exists.

A feature receives **✅ WORKING** only after its complete real-world path has been tested successfully.

**Related:** `docs/VOICE-V2-AFTER-HOURS-PRODUCT-CONTRACT.md` (product architecture) · `docs/VOICE-V3-PSTN-BOOKING-PIPELINE-FROZEN.md` (frozen Microsoft PSTN book path) · `docs/voice-v3/BOOKING-PIPELINE-RUNTIME-PATH.md`

---

## 1. Inbound after-hours call handling

- [ ] Existing business number can forward unanswered calls to Transovo.
- [ ] Existing business number can forward after-hours calls to Transovo.
- [ ] Incoming call resolves the correct workspace/business.
- [ ] Incoming call resolves the correct AI receptionist.
- [ ] Correct published wizard configuration is loaded.
- [ ] Correct business timezone is loaded.
- [ ] Correct GPT-Live voice is loaded.
- [ ] Correct greeting is spoken.
- [ ] Different businesses remain completely isolated.
- [ ] Republishing wizard changes affects subsequent new calls without a code deployment.
- [ ] Existing active calls retain the configuration they started with.

---

## 2. Business knowledge / FAQ

Riley must be capable of answering normal questions that an after-hours receptionist would receive.

- [ ] Business name.
- [ ] Business hours.
- [ ] Open/closed status.
- [ ] Address/location.
- [ ] Service area.
- [ ] Services offered.
- [ ] Basic pricing.
- [ ] Diagnostic/service-call fees.
- [ ] Basic policies.
- [ ] Website/contact information.
- [ ] Business-specific FAQs.
- [ ] Answers use the correct business’s information.
- [ ] Riley does not invent information when the answer isn’t known.
- [ ] Larger business knowledge/documents can be searched when necessary.
- [ ] Changing business information in the wizard changes what subsequent calls know.

---

## 3. Custom caller intake

- [x] Standard intake fields can be collected.
- [x] Wizard-defined custom fields reach Voice V3.
- [x] Required custom fields can block completion.
- [x] Optional fields can remain optional.
- [x] Information can be collected naturally rather than in a rigid order.
- [ ] Caller can correct previously supplied information.
- [ ] Riley doesn’t unnecessarily ask for information already supplied.
- [ ] Enabled/disabled fields are respected.
- [ ] Required/optional changes made in the wizard affect subsequent calls.
- [ ] Different services/workflows can request the appropriate information where configured.

**Production proof already obtained:** custom `mother_s_name` successfully propagated from wizard configuration into real PSTN intake and became part of the completed intake objective.

---

## 4. Take a message

- [ ] Riley recognizes when the caller simply wants to leave a message.
- [ ] Caller name can be collected.
- [ ] Callback number can be collected.
- [ ] Message/reason can be collected.
- [ ] Additional configured fields can be collected.
- [ ] Message is saved.
- [ ] Message is associated with the correct call/business.
- [ ] Business receives/sees the message.
- [ ] Riley accurately confirms that the message was taken.
- [ ] Riley does not claim somebody was contacted when they weren’t.

---

## 5. Callback request

- [ ] Caller can request a callback.
- [ ] Correct caller information is captured.
- [ ] Callback reason is captured.
- [ ] Relevant service/context is captured.
- [ ] Preferred callback timing can be captured where appropriate.
- [ ] Callback request is saved.
- [ ] Correct business/person receives or sees the request.
- [ ] Riley accurately tells the caller what will happen next.

---

## 6. Lead qualification

Keep this focused on receptionist-level qualification—not a giant CRM scoring engine.

- [ ] Wizard qualification questions are available to V3.
- [ ] Qualification rules are respected.
- [ ] Service needed can influence qualification.
- [ ] Service area can influence qualification.
- [ ] Configured urgency can influence qualification.
- [ ] Other configured qualification fields can be used.
- [ ] Qualified caller follows the configured next action.
- [ ] Unqualified caller follows the configured next action.
- [ ] Riley doesn’t invent qualification rules.
- [ ] Changing qualification rules in the wizard changes subsequent calls.

---

## 7. Urgency / emergency handling

Critical for home-service after-hours use.

- [ ] Wizard urgency rules reach V3.
- [ ] Riley can recognize configured urgent situations.
- [ ] Riley can distinguish ordinary requests from configured urgent requests.
- [ ] Urgent calls follow configured escalation behavior.
- [ ] Non-urgent calls do not unnecessarily wake/transfer to on-call staff.
- [ ] Correct on-call destination is selected.
- [ ] Urgency rules are deterministic/configuration-backed where required.
- [ ] Riley does not invent emergency policies.

---

## 8. Microsoft 365 direct booking

**Status:** ✅ CORE PATH PROVEN

- [x] Microsoft connection resolves correctly.
- [x] Correct calendar is used.
- [x] Correct timezone is used.
- [x] Caller can express desired date naturally.
- [x] Scheduling preference is normalized.
- [x] Real availability is queried.
- [x] Available slots are returned.
- [x] Riley can offer real available times.
- [x] Required intake is enforced before BOOK.
- [x] Selected slot is revalidated before booking.
- [x] Microsoft event is actually created.
- [x] Provider event ID is returned.
- [x] Riley confirms only after authoritative booking confirmation.
- [x] Booking idempotency/revalidation protection operates.
- [x] Custom intake works with the booking flow.
- [ ] All configured appointment/service types are voice-certified.
- [ ] Service-specific durations are voice-certified.
- [ ] All booking-behavior wizard switches are certified.

**Production proof:** real Microsoft appointment successfully created during PSTN certification call (ws_1, 2026-09-19). See `docs/VOICE-V3-PSTN-BOOKING-PIPELINE-FROZEN.md`.

---

## 9. Calendly direct booking

- [ ] Calendly account can be connected.
- [ ] Correct Calendly connection is selected.
- [ ] Correct event/service type is selected.
- [ ] Availability can be queried.
- [ ] Riley can offer actual Calendly availability.
- [ ] Required Calendly information is collected.
- [ ] Required Transovo intake information is collected.
- [ ] Appointment is actually created in Calendly.
- [ ] Provider booking ID is retained.
- [ ] Riley confirms only after Calendly confirms.
- [ ] Errors/unavailability fall back safely.
- [ ] Multiple configured Calendly services/event types work.

---

## 10. Send booking link

For businesses that don’t want AI directly booking.

- [ ] Wizard can select SEND_LINK strategy.
- [ ] Correct booking URL is loaded.
- [ ] Correct service-specific link can be selected where applicable.
- [ ] Riley can offer to send the link.
- [ ] Correct caller mobile number is established.
- [ ] Booking link is actually sent by SMS.
- [ ] SMS result is known.
- [ ] Riley only says the link was sent after successful submission.
- [ ] Failed SMS is handled honestly.
- [ ] Riley never claims an appointment was booked merely because a link was sent.

---

## 11. Request / collect-only mode

For businesses that want the receptionist to collect information but not book.

- [ ] Wizard can select REQUEST/COLLECT strategy.
- [ ] Correct intake fields are loaded.
- [ ] Required fields are enforced.
- [ ] Custom fields work.
- [ ] Requested service is captured.
- [ ] Preferred date/time can be captured.
- [ ] Caller notes/reason are captured.
- [ ] Request is saved.
- [ ] Request is delivered/visible to business.
- [ ] Riley accurately explains that the business will follow up.
- [ ] No fake booking confirmation occurs.
- [ ] No calendar mutation occurs.

---

## 12. Multiple services / appointment types

- [x] V3 compiler supports multiple enabled services.
- [ ] Riley can naturally determine which service caller wants.
- [ ] Correct service ID becomes authoritative.
- [ ] Correct service duration is used.
- [ ] Correct calendar/provider configuration is used.
- [ ] Correct intake requirements are used where service-specific.
- [ ] Correct booking link is used where service-specific.
- [ ] Caller can change service during conversation.
- [ ] Availability is recalculated if changing service changes duration/provider.
- [ ] Non-primary service has been real-call certified.

---

## 13. Booking-behavior controls

Each wizard control must actually alter behavior.

- [ ] Ask preferred day first.
- [ ] Offer earliest three.
- [ ] Confirm before booking.
- [ ] Send SMS after booking.
- [ ] Ask service first.
- [ ] Distinguish new vs. existing customer.

For each control:

- [ ] OFF behavior certified.
- [ ] ON behavior certified.
- [ ] Republish changes behavior on subsequent calls.

---

## 14. Find existing appointment

- [ ] Caller identity/appointment can be resolved safely.
- [ ] Correct provider is queried.
- [ ] Correct appointment is identified.
- [ ] Riley can tell caller appointment date/time.
- [ ] Riley can tell caller appropriate service/details.
- [ ] Ambiguous matches require clarification.
- [ ] Riley does not reveal another customer’s appointment.
- [ ] “Appointment not found” is handled appropriately.

---

## 15. Reschedule appointment

- [ ] Existing appointment can be found.
- [ ] Caller can provide new date/time preference naturally.
- [ ] Real replacement availability is queried.
- [ ] Riley offers valid replacement times.
- [ ] Caller selects one.
- [ ] Required confirmation occurs.
- [ ] Provider actually reschedules appointment.
- [ ] Riley confirms only after provider success.
- [ ] Failed reschedule does not destroy original appointment.
- [ ] Correct provider-specific implementation is used.

---

## 16. Cancel appointment

- [ ] Existing appointment can be found.
- [ ] Correct appointment is identified.
- [ ] Caller explicitly confirms cancellation.
- [ ] Provider cancellation is executed.
- [ ] Riley confirms only after provider success.
- [ ] Failed cancellation is reported accurately.
- [ ] Correct provider-specific implementation is used.

---

## 17. Live human transfer

- [ ] Wizard transfer destinations reach V3.
- [ ] Correct destination labels are available.
- [ ] Correct phone numbers remain trusted configuration.
- [ ] Caller can explicitly request a human.
- [ ] Configured rules can trigger transfer.
- [ ] Urgency rules can trigger appropriate transfer.
- [ ] Correct destination is selected.
- [ ] Telnyx actually executes transfer.
- [ ] Riley never invents a transfer destination.
- [ ] Transfer outcome is known.

---

## 18. Transfer fallback / waterfall

- [ ] Detect unanswered transfer.
- [ ] Detect failed transfer.
- [ ] Configured secondary destination can be attempted.
- [ ] Multiple configured destinations can be tried in correct order.
- [ ] Do not repeatedly call the same destination accidentally.
- [ ] Fall back to message when configured.
- [ ] Fall back to callback request when configured.
- [ ] Caller isn’t simply abandoned when transfer fails.
- [ ] Riley explains the resulting action accurately.

---

## 19. After-hours behavior

This is one of the core product features.

- [ ] Business timezone determines open/closed state.
- [ ] Weekly business hours determine open/closed state.
- [ ] Closed days work.
- [ ] Special closures/holidays are respected where configured.
- [ ] Riley knows when business is currently closed.
- [ ] After-hours instructions become active when closed.
- [ ] Normal-hours behavior becomes active when open.
- [ ] Direct booking remains available after hours when allowed.
- [ ] Message taking remains available.
- [ ] Callback requests remain available.
- [ ] Urgent calls can follow special escalation rules.
- [ ] On-call staff can be used when configured.
- [ ] Non-urgent callers don’t unnecessarily reach on-call staff.

---

## 20. SMS during / after call

- [ ] Send booking link.
- [ ] Send booking confirmation.
- [ ] Send configured business/service link.
- [ ] Send appropriate follow-up information.
- [ ] SMS goes to correct caller.
- [ ] Correct business attribution is included.
- [ ] SMS success/failure is known.
- [ ] Riley doesn’t say something was sent when sending failed.
- [ ] SMS behavior follows consent/compliance requirements.

---

## 21. Call fallback / recovery

When Riley cannot complete the preferred action:

- [ ] No availability → appropriate alternative.
- [ ] Booking provider unavailable → appropriate alternative.
- [ ] Booking fails → no false confirmation.
- [ ] Transfer unavailable → message/callback fallback.
- [ ] Unknown business question → no hallucination.
- [ ] Caller doesn’t want offered times → continue appropriately.
- [ ] Unable to identify appointment → clarification/fallback.
- [ ] Tool timeout/error → safe recovery.
- [ ] Caller always has a useful next step when reasonably possible.

---

## 22. Call summary

After the call, the business should be able to determine what happened without listening to the whole recording.

- [ ] Caller identity.
- [ ] Caller phone.
- [ ] Reason for call.
- [ ] Requested service.
- [ ] Important intake answers.
- [ ] Qualification result where applicable.
- [ ] Urgency/escalation result where applicable.
- [ ] Appointment outcome.
- [ ] Message outcome.
- [ ] Callback outcome.
- [ ] Transfer outcome.
- [ ] Concise call summary.
- [ ] Associated with correct workspace/business.

---

## 23. Call history / transcript / recording

- [ ] Durable V3 call record exists.
- [ ] Call start/end.
- [ ] Duration.
- [ ] Caller number where permitted.
- [ ] Business number.
- [ ] Agent.
- [ ] Call outcome.
- [ ] Transcript.
- [ ] Recording when enabled/configured.
- [ ] Tool/action history where appropriate.
- [ ] Appointment/message/callback result associated with call.
- [ ] Calls visible to correct customer only.

**Known current gap:** successful V3 PSTN certification call did not create the expected `voiceCall` row.

---

## 24. Spam / solicitor screening

Lower priority than the core receptionist flows, but part of competitive after-hours functionality.

- [ ] Detect obvious spam/solicitation appropriately.
- [ ] Avoid unnecessary on-call escalation.
- [ ] Avoid unnecessary appointment workflows.
- [ ] Legitimate callers aren’t aggressively blocked.
- [ ] Business can control desired handling.

---

## 25. Multilingual callers

Core English functionality comes first. Then:

- [ ] Spanish caller can converse naturally.
- [ ] Business facts remain accurate in another language.
- [ ] Intake remains structured correctly.
- [ ] Scheduling remains authoritative.
- [ ] Tool arguments remain canonical regardless of spoken language.
- [ ] Booking confirmation remains accurate.
- [ ] Transfer/message/callback flows continue working.

---

## 26. Greeting / persona / GPT-Live voice

- [x] Wizard agent name reaches production V3.
- [x] Wizard business name reaches production V3.
- [x] Wizard greeting reaches production V3.
- [x] Wizard GPT-Live voice reaches production V3.
- [x] Changing the voice and republishing changes the actual PSTN voice.
- [x] 22 GPT-Live built-in voices exposed by V3 wizard.
- [ ] Remaining supported persona/conversation controls are behavior-certified.
- [ ] Unsupported Live API controls remain clearly identified rather than silently pretending to work.

---

## 27. Capability gating

If the business disables something, Riley must stop offering/performing it.

- [ ] Booking disabled.
- [ ] Availability checking disabled.
- [ ] Transfers disabled.
- [ ] Message taking disabled.
- [ ] SMS disabled.
- [ ] Intake configuration respected.
- [ ] Disabled capability isn’t offered conversationally.
- [ ] Astra doesn’t execute disabled capability.
- [ ] Deterministic runtime rejects unauthorized execution as final protection.

---

## Definition of After-Hours V1 complete

The receptionist must be capable of performing this complete loop:

**Answer call**

→ know the business

→ understand why the caller called

→ answer normal questions

→ collect configured information

→ qualify/escalate when appropriate

→ perform the configured scheduling strategy: **Microsoft / Calendly / Send Link / Request Only**

→ manage an existing appointment when necessary: **Find / Reschedule / Cancel**

→ transfer an appropriate caller

→ fall back safely when transfer fails

→ take a message or callback request

→ send appropriate SMS

→ follow different after-hours/urgency behavior

→ accurately tell the caller what actually happened

→ leave the business with a usable call record, summary and captured information.

---

## Already proven on real PSTN

- ✅ Published wizard → V3 compiler → production call
- ✅ GPT-Live frontend
- ✅ Astra backend delegation
- ✅ Wizard business name
- ✅ Wizard agent name
- ✅ Custom greeting
- ✅ Changed GPT-Live voice heard on actual call
- ✅ Dynamic custom intake
- ✅ Required intake enforcement
- ✅ Scheduling preference
- ✅ Real Microsoft availability
- ✅ Slot offering
- ✅ Booking revalidation
- ✅ Real Microsoft event creation
- ✅ Authoritative booking confirmation

The rest of this document is the checklist we work down until the After-Hours AI Receptionist V1 is complete.

When we work on Calendly, transfer fallback, request-only, or any other area, we do not invent new scope—we implement that section here, certify it end-to-end, and mark it off.
