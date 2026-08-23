# Transovo product feature report

Classification of the product addendum (Aug 2025–2026) against this branch.

## Added

- Per-person destination availability (`availabilityStatus`, `unavailableUntil`) with pause/resume API
- **Pause calls to me** mobile-friendly control (`PauseCallsControl`, `/api/smart-routing/availability`)
- Ring groups skip unavailable members at runtime (no membership mutation)
- **Answer Confirmation** per destination (`answerConfirmationEnabled` → whisper on transfer)
- Unified **Needs Attention** queue (`/voice/needs-attention`, deduped by caller)
- Lightweight assignment + mark done on callbacks, voicemails, missed calls
- **Call Back as Business** on missed-call detail; voicemail uses outbound bridge (not `tel:`)
- Voicemail → **Needs Callback** creates canonical `CallbackRequest`
- Temporary **route override** (send all calls to one destination)
- Caller history API for missed-call detail
- Human-readable routing outcome labels in activity feed
- Call Screening template rename + Simple Business / Simple Reception presets
- Menu behavior compiler pass (no-input, invalid, Press 0 via metadata)
- Whisper accept timeout default 8s

## Extended

- Business Call Back / Last Caller (prior commits on branch)
- Callback Requests completion (`completedByUserId`, assignment)
- Visual Voicemail: mark resolved, assign, needs callback
- Close Now + route override in setup
- People & Destinations: availability indicators, pause per person
- Templates: Call Screening naming, after-hours presets (existing engine)

## Already existed (preserved)

- Outbound bridge, authorized callers, PIN access
- MCTB both modes (`press_1`, `existing_consent`)
- Smart Routing runtime: call gate, ring groups, voicemail, callback node, business hours
- Visual voicemail transcription stack
- MCTB: links, forms, exclusions, repeat callers, analytics
- Visual flow builder, AI Routing Assistant (nav-gated), audio library

## Deferred (out of product boundary)

- Softphone / browser phone / mobile calling app
- Extension dialing, call parking, conference, fax, video
- CRM pipelines, sales stages, enterprise task management
- AI spam classification (interaction gate only)
- Workforce scheduling beyond pause/route override
