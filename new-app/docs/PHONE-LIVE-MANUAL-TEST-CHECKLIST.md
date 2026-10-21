# Transovo Phone — Live manual test checklist (owner)

Run these **after** `npm run test:phone:audit` passes. Automated tests prove wiring; only real PSTN/media can prove carrier behavior.

## Business Phone

- [ ] Inbound call from external mobile reaches your Transovo line
- [ ] Outbound call connects with acceptable audio both ways
- [ ] Caller ID on callee device matches configured outbound ID
- [ ] Browser Phone rings and can answer a forwarded test call

## Call forwarding

- [ ] Forward to your cell — answer, reject, and let ring unanswered
- [ ] After-hours path differs from business-hours path as configured
- [ ] Forwarding loop (business number → Transovo → same business number) is blocked or fails safely

## Ring groups

- [ ] Correct members ring (sequential or simultaneous per config)
- [ ] First answer wins; other legs stop ringing

## Voicemail

- [ ] Hear live greeting on unanswered call
- [ ] Leave message; play back in Phone UI
- [ ] Recording quality acceptable

## Auto Attendant

- [ ] Hear menu; DTMF routes to intended destination
- [ ] Invalid digit / timeout uses configured fallback

## Conversational IVR

- [ ] Real speech understood; can interrupt and ask follow-ups
- [ ] Callback request captured and visible in product
- [ ] Authorized transfer rings staff; failed transfer uses fallback

## Power Dialer

- [ ] Start session; place real test calls to controlled numbers
- [ ] Dispositions save; session pause/resume behaves correctly
