# MCTB SMS — Response length / segment economics (production rule)

This is an **SMS agent**, not a chat app. Brevity and segment count are **hard product requirements**, not style preferences.

## Encoding (canonical)

Implemented in `src/lib/sms/segment-encoding.ts` (also used by `estimateSmsSegments` in `src/lib/utils.ts`).

| Encoding | Single segment | Concatenated (per part) |
|----------|----------------|-------------------------|
| GSM-7    | 160 chars      | 153 chars               |
| UCS-2    | 70 chars       | 67 chars                |

Non-ASCII body → UCS-2 (same rule as mass texting). Do **not** estimate segments from character count alone without encoding.

## Default outbound behavior

1. Correctness and policy first  
2. Clarity  
3. Brevity  
4. Minimal segment usage  

- Prefer **1 segment** for ordinary turns  
- Prefer **≤ 160 GSM-7** characters when practical  
- No paragraph-length chatbot answers  
- One clear question at a time (unless one short message can collect multiple fields)  
- **One inbound → one outbound SMS** unless runtime intentionally sends a sequence  

## Model / phrasing prompt (permanent)

`MCTB_SMS_CHANNEL_SYSTEM` in `src/lib/mctb/sms-channel.ts` is appended to MCTB phrasing prompts (e.g. `RESPONSE_PHRASING_SYSTEM`). It does **not** replace deterministic runtime policy.

## Certification (DeepSeek + templates)

Runner: `runSmsSegmentCertification` in `cert-sms.ts`, invoked from `mctb-lead-recovery-deepseek-cert.ts`.

**Hard fail**

- `UNNECESSARY_3_PLUS_SEGMENT_REPLY` on **ordinary** scenarios  
- `UNNECESSARY_UCS2` (decorative Unicode when GSM-7 would suffice)  

**Metrics recorded**

- `AVG_RESPONSE_CHARACTERS`, `P95_RESPONSE_CHARACTERS`  
- `AVG_SEGMENTS_PER_REPLY`, `P95_SEGMENTS_PER_REPLY`  
- `ONE_SEGMENT_REPLY_RATE`, `PERCENT_TWO_SEGMENTS`, `THREE_PLUS_SEGMENT_REPLY_RATE`  
- `UNNECESSARY_3_PLUS_SEGMENT_COUNT`, `UNNECESSARY_UCS2_COUNT`  
- `MULTI_OUTBOUND_PER_TURN_RATE` (E2E when wired)  

## Examples

| BAD | GOOD |
|-----|------|
| Long thank-you + scheduling paragraph | `Sure — I can check tomorrow afternoon. What time works best?` |
| Apologetic flooding essay + address ask | `Got it — flooding is urgent. What's the service address?` |
| Verbose booking confirmation | `You're booked for Friday at 3 PM.` |
