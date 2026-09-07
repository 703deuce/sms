# Transovo MCTB Page Build Spec — 11: Consent

**Status:** Active — mandatory implementation specification  
**Primary route:** `/mctb/setup/consent`  
**Wizard role:** First-time setup Step 3  
**Product:** Missed Call Text Back  
**Page archetype:** High-consequence configuration editor  
**Canonical navigation:** MCTB → Setup → Consent  
**Audience:** Cursor/frontend implementation agents  
**Visual baseline:** Finished Transovo Appointment configuration screens + canonical Transovo design system  
**Governing documents:** All Transovo Governance, IA, HCD, Page Architecture, Visual Design, Accessibility, Responsive, Privacy/Consent, Date/Time, i18n, and MCTB-specific scope/IA/manifest/page specs (including **spec 07 — Setup architecture**)

**Cursor rule:** `.cursor/rules/transovo-mctb-page-spec-11-consent.mdc` (`alwaysApply: true`)

---

## 1. Master Cursor rule

Consent is a high-consequence MCTB configuration surface that determines how the product establishes or relies on messaging permission for missed-call recovery. The page must support two distinct canonical modes: **Ask callers to press 1** (`press_1`) and **Use permission my business already has** (`existing_consent`). These modes must remain semantically, operationally, and evidentially distinct. Press-1 creates platform-captured consent evidence through an intentional caller action; Existing Permission relies on external/business permission provenance and must never be represented as Transovo-captured consent. Consent is not a boolean, sender registration is not recipient consent, A2P approval is not recipient consent, and the UI must never provide a bypass around canonical eligibility, opt-out, or suppression logic.

---

## 2. Primary user question

**First-time setup:**

"How should Transovo get or rely on permission to text missed callers?"

**Existing customer:**

"Which consent method am I using, and how do I change it?"

---

## 3. Exact responsibility of this page

This page owns:

* consent mode selection
* Press-1 disclosure configuration
* Press-1 audio/voice asset
* Press-1 preview
* Press-1 publish/active state
* Existing Permission attestation/provenance
* concise explanation of current consent method
* link to canonical consent evidence/history
* consequences of switching methods
* configuration readiness for consent

It does not own:

* SMS sender registration
* toll-free verification
* A2P Brand/Campaign configuration
* message-template editing
* opt-out override
* carrier forwarding
* generic legal/compliance certification
* full Consent Log management
* AI eligibility decisions

---

## 4. Canonical modes

**User-facing choices:**

**Ask callers to press 1**

Supporting text:

Callers hear a short disclosure and intentionally press 1 before Transovo starts the text conversation.

Technical value: `press_1`

**Use permission my business already has**

Supporting text:

Use this only when your business already has the applicable permission to text the caller about this inquiry.

Technical value: `existing_consent`

Do not expose the enum as the primary UI label.

---

## 5. Forbidden labels

Do not call the choices:

* Manual / Automatic
* Safe / Fast
* Compliance / No compliance
* Ask permission / Skip permission
* Strict / Easy
* Press-1 / Auto text

Especially prohibited:

**Skip consent**

Existing Permission does not mean "skip consent."

---

## 6. Consent is not a boolean

Do not model or present consent as:

```
consent = true
```

Canonical conceptual evidence includes things like:

```
channel
purpose
status
provenance
captured_at
withdrawn_at
source
disclosure_version
evidence_type
```

Exact backend fields may differ, but the architecture must preserve these distinctions.

---

## 7. Press-1 flow

Canonical runtime sequence:

```
Missed call
    ↓
Voice disclosure plays
    ↓
Caller intentionally presses 1
    ↓
Consent event recorded
    ↓
System confirmation SMS
    ↓
Conversation opener
```

The UI must not mark consent captured before the DTMF action succeeds.

---

## 8. Existing Permission flow

Canonical sequence:

```
Missed call
    ↓
Workspace configured for Existing Permission
    ↓
Business/external permission provenance available
    ↓
Canonical eligibility check
    ↓
Recovery text may send if all other rules pass
```

No Press-1 event is invented.

No fake platform evidence is created.

---

## 9. Screenshot calibration requirement

Before styling this page, Cursor should inspect completed Transovo screens demonstrating:

* radio/choice groups
* serious-setting warnings
* audio preview controls
* configuration status rows
* save/publish state
* helper/explainer copy
* attestation checkbox pattern
* read-only/audit link pattern
* mobile forms

Use the same components/tokens.

Do not create a special compliance-themed aesthetic.

---

## 10. Page header

**H1**

Consent

Supporting line:

Choose how Missed Call Text Back establishes or relies on permission to send recovery texts.

Avoid:

* Messaging Legality
* TCPA Settings
* Compliance Engine
* Consent Processor

---

## 11. Current mode summary

Existing customer should immediately see:

```
Current method
Ask callers to press 1
Status
Ready
Prompt
Published
```

or:

```
Current method
Use permission my business already has
Status
Ready
Permission source
Business-attested
```

Do not show one generic Compliant badge.

---

## 12. Mode choice control

Use a semantic radio group.

Example:

```
How should permission be handled?

○ Ask callers to press 1
  Recommended when you want Transovo to capture permission during the call.

○ Use permission my business already has
  Use only when your business already has the applicable permission to text the caller.
```

One mode active at a time.

---

## 13. Recommendation language

If Transovo wants to recommend Press-1 for certain customers, wording must remain factual.

Good:

Recommended if you want Transovo to capture permission during the call.

Bad:

* Safest option
* Fully compliant option
* Legally guaranteed option

Do not make broad legal guarantees.

---

## 14. Press-1 section

When selected, reveal:

* Ask callers to press 1
* Disclosure
* Voice / audio
* Preview
* Publish status

Only relevant controls.

Do not show Existing Permission attestation.

---

## 15. Press-1 disclosure

The disclosure is high-consequence customer-facing copy.

It should come from a centralized/versioned policy source where possible.

The user may be allowed to customize business-specific variables, but must not casually remove required disclosures.

Cursor must inspect current runtime before deciding what is editable.

---

## 16. Press-1 disclosure editor

If policy allows limited editing:

Make the boundary explicit.

Example:

```
Consent disclosure
System-required wording
[locked text]
Business name
Joe's Plumbing
```

Do not present the entire disclosure as a freeform textarea if runtime/policy requires controlled wording.

---

## 17. Disclosure preview

User must be able to hear or review what the caller will hear.

Show:

What callers will hear

Then actual current disclosure.

No fake generic example when a real configured prompt exists.

---

## 18. Audio source

The active Press-1 prompt may use the existing MCTB consent prompt/audio system.

Potential source types:

* standard Transovo voice
* generated TTS
* selected approved voice
* uploaded/recorded asset only if current runtime actually supports it

Do not automatically import the full Voicemail greeting-builder feature set unless the consent prompt runtime truly supports those same sources.

---

## 19. Voice controls

Only expose actual supported options.

Potential:

```
Voice
[Transovo standard voice ▼]
[Preview]
```

If generated audio must be created:

```
[Generate preview]
```

Do not show ElevenLabs here just because Voicemail uses ElevenLabs unless Press-1 prompt generation is actually wired to it.

---

## 20. Prompt generation state

Canonical states:

* Draft
* Generating
* Ready
* Published
* Failed

Do not show Published before backend confirms the active asset.

---

## 21. Existing active prompt preservation

If a new prompt/audio generation fails:

Keep the currently published prompt active.

Example:

```
New prompt couldn't be generated. Your current consent prompt is still active.
```

Do not create a window where callers receive no disclosure.

---

## 22. Preview vs Publish

If runtime distinguishes them:

**Preview** — Lets user inspect/hear the candidate prompt.

**Publish** — Makes it active for calls.

Do not call Save = Publish if they are distinct.

If runtime immediately activates on save, represent that truthfully instead.

---

## 23. Published state

Example:

```
Active consent prompt
Published Sep 7 at 2:14 PM
Voice: Transovo standard
```

Compact factual treatment.

No giant success card.

---

## 24. Press-1 input behavior

The runtime expects intentional DTMF.

UI explanation:

The caller must press 1 to continue with text messaging.

Do not imply speech like "yes" counts unless runtime actually supports it.

---

## 25. No Press-1 completion

If caller hears prompt but does not press 1:

Canonical outcome:

Consent not captured

Then no Press-1 recovery text should send.

Do not label this:

Failed consent

unless that is canonical vocabulary.

---

## 26. Consent evidence

A successful Press-1 event should preserve evidence such as:

* caller
* business/workspace
* method
* timestamp
* scope/purpose
* disclosure/prompt version
* source call
* evidence reference

The page itself only summarizes this model.

Full evidence belongs in Consent History/Log.

---

## 27. Consent-history link

Include a contextual action:

View consent history

or:

View consent records

This links to the canonical audit surface.

Do not put Consent Log in the main operational nav solely because this link exists.

---

## 28. Existing Permission section

When selected, reveal:

* Use permission my business already has
* Explanation
* Attestation
* Permission provenance

No Press-1 audio controls.

---

## 29. Existing Permission explanation

Use precise language:

Transovo will rely on permission your business already obtained outside this Press-1 flow. Transovo does not create or verify that historical permission merely because this mode is selected.

This distinction is important.

---

## 30. Existing Permission attestation

Require explicit affirmative attestation.

Example concept:

☐ I confirm that my business has the applicable permission to text callers covered by this setting about their inquiry.

Never prechecked.

Do not bury it in Terms acceptance.

---

## 31. Attestation is not evidence fabrication

The stored record should represent:

Business attestation / external permission provenance

not:

Consent captured by Transovo

The UI and backend must preserve that distinction.

---

## 32. Permission source/provenance

If the product allows additional structured provenance, potential choices could include:

* Existing customer relationship
* Web form consent
* Written permission
* Other external permission

Only expose these if they actually map to backend evidence/provenance and product policy.

Do not add decorative legal categories with no runtime use.

---

## 33. Free-text provenance

If a notes/source field exists:

Label clearly:

Permission source

or:

How was permission obtained?

Do not let this text itself magically turn eligibility true if canonical policy requires more than a note.

---

## 34. Existing Permission review state

Potential readiness:

* Attestation required
* Ready

Do not show:

Consent verified

unless Transovo actually verifies the external evidence.

---

## 35. Switching from Press-1 → Existing Permission

This is consequential.

Before saving, explain actual effect:

New missed calls will no longer use the Press-1 consent prompt. Transovo will rely on the permission source configured for Existing Permission instead.

Require confirmation if appropriate.

Do not erase historical Press-1 evidence.

---

## 36. Switching from Existing Permission → Press-1

Explain:

New eligible missed calls will use the Press-1 disclosure before recovery texts are sent.

If no published prompt exists, switching cannot become operationally Ready until prompt setup is complete.

---

## 37. Switching mode does not rewrite history

Historical events retain:

* original consent method
* original evidence
* original disclosure version
* original timestamps

Never relabel old Existing Permission events as Press-1 after a settings change.

---

## 38. Switching mode does not override opt-out

If caller opted out:

Changing consent mode does not make them eligible again.

This must remain enforced centrally.

---

## 39. Consent vs opt-out

These are separate states.

Possible:

```
Consent captured
then later
Opted out
```

Current messaging eligibility becomes blocked.

Historical consent evidence remains.

Do not delete consent history when opt-out occurs.

---

## 40. Consent vs sender registration

Separate:

**Recipient consent** — Press-1 captured

and:

**Sender** — Registration pending

A valid consent event does not mean the sender can send.

Likewise approved 10DLC/TFV does not mean the recipient consent exists.

---

## 41. Consent vs phone availability

A caller can have valid consent but no usable SMS-capable phone number.

That remains a separate eligibility blocker.

Do not overload Consent page with every eligibility state.

---

## 42. Consent vs business exclusion

A business-added exclusion may suppress sends even if consent exists.

Again separate.

Consent page should not imply:

Consent captured = message guaranteed

---

## 43. Canonical eligibility relationship

Compact helper:

Consent is one part of messaging eligibility. Transovo also checks opt-out state, exclusions, sender readiness, pause state, cooldown/follow-up rules, and other applicable blockers before sending.

This is useful because it prevents users from misunderstanding the setting.

---

## 44. AI prohibition

AI may not:

* decide whether consent exists
* infer consent from conversation text
* convert a vague note into permission
* clear an opt-out
* invent provenance
* choose Press-1 vs Existing Permission automatically without explicit configured policy

Eligibility remains deterministic.

---

## 45. First-time wizard version

Keep the wizard concise.

Example:

```
How should Transovo handle permission to text?

○ Ask callers to press 1
  Callers hear a short disclosure and press 1 before texts begin.

○ Use permission my business already has
  Use this only when your business already has permission to text these callers.

[Back]                              [Continue]
```

If Press-1 selected, wizard then exposes required prompt preview/setup inline or as the next sub-state of the same step.

If Existing Permission selected, require attestation before Continue.

---

## 46. Wizard should not expose full audit detail

First-time user does not need:

* prompt asset IDs
* consent-log columns
* evidence schemas
* provider call IDs

Just enough to make a correct choice and reach readiness.

---

## 47. Post-setup editor

Existing customer path:

```
MCTB → Setup → Consent
```

No wizard progress.

Show:

* current method
* readiness
* relevant editor
* save/publish
* consent-history link

---

## 48. Save behavior

Mode/config changes should save through canonical backend configuration.

On success:

Consent settings updated.

On failure:

```
Changes couldn't be saved.
Your selections are still here.
[Try again]
```

Do not change runtime mode optimistically before server confirms.

---

## 49. Publish failure

If configuration saves but new Press-1 prompt fails to publish:

Keep old active prompt/mode behavior safe.

Example:

```
Consent settings were saved, but the new prompt couldn't be published. The previous prompt is still active.
```

Exact behavior depends on backend transaction model.

Do not show Ready if active runtime is inconsistent.

---

## 50. Readiness model

**Press-1**

* mode selected
* disclosure configured
* audio ready
* prompt published
* Ready

**Existing Permission**

* mode selected
* attestation complete
* required provenance complete
* Ready

Do not reduce both to one generic checked box.

---

## 51. Status language

Good:

* Ready
* Prompt not published
* Attestation required
* Configuration incomplete

Avoid:

* Compliant
* Legal
* Approved by TCPA
* Fully verified

unless referring to a specific factual provider approval unrelated to recipient consent.

---

## 52. Loading state

Do not briefly default to Press-1 or Existing Permission before server config loads.

Use loading state until canonical config is known.

This avoids accidental save of wrong mode.

---

## 53. Error state

If consent settings cannot load:

```
Consent settings couldn't be loaded.
[Retry]
```

Do not allow editing unknown state.

---

## 54. Partial/degraded state

Examples:

* Mode config loads, audio service unavailable — Press-1 settings visible; prompt preview/generation locally unavailable.
* Consent history unavailable — Configuration still editable; audit link/component shows local error.
* Existing Permission mode ready, unrelated sender state unavailable — Do not degrade this page unnecessarily.

---

## 55. Read-only permission

A staff member may see:

```
Consent method
Ask callers to press 1
Prompt
Published
```

but not modify.

Explain:

You can view this setting, but you don't have permission to change consent configuration.

Server enforcement required.

---

## 56. Consequential confirmation

Switching consent modes is significant enough to warrant a deliberate review/confirmation.

Example:

```
Change consent method?

This changes how future missed-call recovery messages establish permission.
```

Then summarize from/to.

Do not require typing a phrase unless policy truly warrants it.

---

## 57. Existing Permission attestation change

If user unchecks/removes attestation:

Runtime should not remain falsely Ready.

Canonical status updates to incomplete/blocked according to policy.

Do not leave stale ready state.

---

## 58. Prompt versioning

Press-1 evidence should refer to the exact disclosure/prompt version presented.

If disclosure changes:

* new version applies prospectively
* historical events keep old version reference

Do not mutate past evidence.

---

## 59. Consent correction

Historical consent events are not editable.

If an admin correction mechanism exists, it should append a correction/audit event rather than overwrite original evidence.

This page should not expose direct editing of past consent.

---

## 60. Revocation

Consumer revocation/opt-out is not controlled here.

The page should not have:

* Undo opt-out
* Restore consent
* Force eligible

Any future re-permission flow must create a new valid permission event where appropriate.

---

## 61. STOP handling

STOP and equivalent runtime opt-out behavior is centralized in messaging/compliance.

Consent page may explain:

Customer opt-outs continue to override this setting.

It does not own STOP parsing.

---

## 62. HELP handling

HELP behavior likewise remains centralized in messaging policy/runtime.

Do not configure it here unless product has a genuine corresponding setting.

---

## 63. Consent Log relationship

The canonical audit page should show evidence from both modes but distinguish provenance.

Press-1 row:

```
Method: Verified Call Consent
Source: Caller pressed 1
```

Existing Permission row/event:

```
Method: Existing Permission
Source: Business attestation / external permission
```

Never render them identically if provenance differs.

---

## 64. Missed Call Detail relationship

One missed-call event should summarize:

```
Consent: Captured via Verified Call Consent
```

or:

```
Consent method: Existing Permission
```

and link to evidence where applicable.

Same authoritative data.

---

## 65. Text Back relationship

Text Back page consumes current consent mode to decide which message sequence to preview/configure.

It must not independently store a second consent mode.

---

## 66. Test & Diagnostics relationship

Live test adapts to active mode.

**Press-1** — Checkpoints include: prompt played, caller pressed 1, consent recorded.

**Existing Permission** — Those checkpoints are not applicable.

Do not fake them.

---

## 67. Runtime contract

Cursor should audit/reuse canonical fields/services for concepts like:

```
consent_mode
press1_prompt_config
press1_prompt_asset
press1_prompt_version
press1_publish_status
existing_consent_attestation
existing_consent_provenance
consent_readiness
```

Exact names depend on current backend.

Do not create a second frontend consent store.

---

## 68. Consent event contract

Press-1 event should conceptually preserve:

```
workspace_id
missed_call_id
caller
channel
purpose
method
captured_at
source_call
disclosure_version
evidence_reference
```

Existing Permission should preserve distinct source/provenance.

Do not force both into a misleading identical structure if evidence differs.

---

## 69. Central consent service

Preferred architecture:

```
Setup configuration
    ↓
Canonical consent policy/service
    ↓
Runtime eligibility
    ↓
Evidence/audit events
```

Not independent consent logic in Setup, Missed Calls, Text Back, and Conversations.

---

## 70. Fail-closed behavior

If required consent state cannot be established or canonical policy service fails:

Do not send based on guess.

Runtime should fail closed for the affected path.

UI reports factual blocker.

---

## 71. Provider outage does not fabricate consent

If voice/consent evidence provider data is unavailable:

Do not mark caller consented because the message would otherwise be useful.

Evidence must exist.

---

## 72. Mobile

One-column:

```
Consent
Current method
[radio choices]
Conditional configuration
Save changes
```

Press-1 preview/audio controls stack.

Existing Permission attestation stays fully visible.

No horizontal stepper here post-setup.

---

## 73. Mobile audio

If Press-1 preview is audio:

* accessible play/pause
* compact controls
* no wide waveform dependency
* software/browser compatibility handled

---

## 74. Accessibility

At minimum:

* one H1
* radio group inside fieldset/legend
* attestation checkbox native and not prechecked
* helper text associated
* locked policy text not fake disabled input
* audio player accessible
* publish/save status announced
* warning/confirmation keyboard accessible
* visible focus
* no color-only readiness
* 44px touch targets
* 320px reflow
* 200% zoom

---

## 75. Focus behavior

Switching mode should not unexpectedly throw focus.

Conditional content appears immediately after the selected choice.

If confirmation modal opens on Save, focus follows canonical modal rules.

After successful save, focus remains logical.

---

## 76. Internationalization

This page needs extra caution because consent disclosure is high-risk customer-facing copy.

Requirements:

* UI strings externalized
* canonical internal enum values not localized
* customer-facing disclosure supports explicit communication locale
* high-risk translations reviewed/versioned
* prompt version includes language/locale where relevant
* admin locale does not automatically determine caller-facing language
* RTL-safe layout
* phone numbers/codes bidi-isolated where needed

---

## 77. Customer-facing language

If multiple consent prompt languages are supported, configuration must be explicit.

Potential future:

```
Consent prompt language
English
Spanish
```

Only if runtime truly supports it.

Do not infer from caller name/phone or admin locale.

---

## 78. Historical language integrity

If a caller heard the Spanish disclosure, evidence must reference that actual version/language.

Do not later display only current English copy as though it were what the caller heard.

---

## 79. Security/privacy

Consent evidence can be consequential.

Apply:

* tenant scoping
* role controls
* immutable history
* no raw secrets
* no public evidence URLs
* secure audio asset access
* audit for sensitive config changes where required

---

## 80. Audit consent-setting changes

Changing consent method should be auditable if the broader security/compliance model supports configuration audit.

Potential event:

```
Consent method changed
Press-1 → Existing Permission
Changed by Sarah
Sep 7 · 2:14 PM
```

Do not add this UI unless canonical audit infrastructure exists, but backend change history is valuable.

---

## 81. Prohibited patterns

Cursor must not:

* model consent as a generic boolean
* label Existing Permission "Skip consent"
* infer consent from silence
* precheck Existing Permission attestation
* treat Terms acceptance as SMS consent
* treat A2P approval as recipient consent
* treat TFV approval as recipient consent
* let AI decide permission
* clear consumer opt-out from this page
* rewrite historical consent evidence
* show Press-1 controls in Existing Permission mode
* show Existing Permission attestation in Press-1 mode
* publish a new prompt before it is ready
* replace a working active prompt with a failed generation
* claim blanket TCPA/legal compliance
* expose raw provider IDs/secrets
* create a second consent engine
* let frontend determine final send eligibility

---

## 82. Test scenarios

Cursor must certify:

**A.** First-time Press-1 — choose mode, prompt preview, publish/ready, Continue saves  
**B.** Successful Press-1 runtime — prompt plays, DTMF 1, consent event, disclosure version  
**C.** Caller does not press 1 — no consent, no recovery text  
**D.** Existing Permission — attestation unchecked blocks Ready, distinct provenance  
**E.** Switch Press-1 → Existing Permission — consequence review, history unchanged  
**F.** Switch Existing Permission → Press-1 — requires published prompt  
**G.** Opted-out caller — mode switch does not restore messaging  
**H.** Prompt generation failure — prior prompt stays active  
**I.** Consent-history service failure — config still usable  
**J.** Read-only user — view only, server blocks changes  
**K.** Mobile/keyboard/screen reader — full workflow

---

## 83. Definition of done — Consent

Cursor may mark Consent complete only when:

* [ ] Uses canonical Transovo configuration visual language
* [ ] Supports both `press_1` and `existing_consent`
* [ ] Uses plain user-facing labels
* [ ] Existing Permission is never described as skipping consent
* [ ] Mode selection uses semantic radios
* [ ] Press-1 configuration is conditionally shown
* [ ] Existing Permission configuration is conditionally shown
* [ ] Attestation is explicit and never prechecked
* [ ] Existing Permission provenance remains distinct from platform-captured consent
* [ ] Press-1 prompt/disclosure reflects actual runtime
* [ ] Active prompt survives failed replacement
* [ ] Preview and Publish semantics match backend
* [ ] Consent evidence references actual prompt/disclosure version
* [ ] Historical consent records are not mutated
* [ ] Switching modes affects future events only
* [ ] Switching mode does not override opt-outs
* [ ] Sender registration remains separate
* [ ] A2P/TFV not misrepresented as recipient consent
* [ ] Consent page does not duplicate full Consent Log
* [ ] Consent History is contextually linked
* [ ] Missed Call Detail/Text Back/Test use the same canonical consent state
* [ ] AI cannot determine or fabricate permission
* [ ] Runtime fails closed when consent state cannot be established
* [ ] Loading/error/partial/read-only states complete
* [ ] High-consequence changes are reviewed deliberately
* [ ] Mobile/320px/200% zoom pass
* [ ] Keyboard/screen-reader form/audio flows pass
* [ ] i18n/versioning architecture supports high-risk disclosure copy
* [ ] Tenant/security/audit controls preserved
* [ ] No duplicate consent engine introduced
* [ ] Existing working MCTB consent runtime/tests preserved

---

## Build handoff

Page-spec series for this MCTB pass is **complete** (specs 01–12). See `docs/TRANSOVO-MCTB-PAGE-BUILD-SPECS.md`.
