# MCTB: ingress vs platform sender + your 2026-10-03 test call

## Short answer

**You are right about the product model.** Forwarding destination (voice ingress) and text-back sender must be **different numbers**. Customers should **not** be told to forward their business line to the **platform SMS sender**.

On **`ws_1` (cert workspace) today**, **+1 (866) 602-0680** is doing **both**:

- `platformMctbSender: true` (platform text-back sender)
- MCTB TeXML voice ingress (`missedCallTextConfig` / setup “forward here”)

That colocation is **legacy/cert wiring**, not the target model for new customers. The codebase already **blocks** assigning `platform_mctb_sender` numbers from the toll-free ingress pool for **new** workspaces; those workspaces get dedicated ingress like **+1 (888) 555-9001 / 9003**, separate from sender.

---

## Three roles (locked)

| Role | Your setup | What customers do |
|------|------------|-------------------|
| **Business line** | +1 (571) 477-6175 | Call this number |
| **Forwarding destination (ingress)** | Currently **866-602-0680** on `ws_1` | Carrier CFNA forwards unanswered calls **here** (hidden; not for texting) |
| **Text-back sender** | Platform sender is **also 866** on `ws_1` | Customers receive **SMS from** this number (separate from ingress in the product design) |

Setup UI on `ws_1` shows **866** as “forward unanswered calls here” because `getProductionMctbForwardTargetE164()` resolves the workspace ingress DID — which on `ws_1` is the same E.164 as the platform sender. **That is confusing and wrong for production commercial onboarding**, even though voice (voicemail) can still work.

---

## Your latest test call (~2026-10-03 00:35 UTC)

After disk/Redis repair, the pipeline **did run** for this call.

| Field | Value |
|--------|--------|
| Call id | `v3:ZwzwSj-Lc9QzpYnqhOhNCMKZb32AInc6I-UFgyG__BUBzAP13ck-WQ` |
| From (your cell) | +1 (703) 816-6017 |
| To (ingress) | +1 (866) 602-0680 |
| Missed call row | `cmurnv1zi226y6c3g0y3j5b5k` |
| **Outcome** | **SUPPRESSED** — `NOT_FORWARD_EVENT` |
| `forwardedFromE164` on hangup | **null** (no carrier Forwarded-From in Telnyx TeXML status) |

### Why no text this time

Not because “SMS can’t send from the same number as ingress” in code — recovery SMS uses the **sender** path separately.

This call was blocked because:

1. **`requireCarrierForward` is enabled** (default MCTB config).
2. The hangup webhook had **no proof the call arrived via CFNA** from your business line (`ForwardedFrom` / diversion empty).
3. Eligibility treats that as **direct dial to ingress** → **`NOT_FORWARD_EVENT`** → no recovery text.

So either:

- The test dialed **866 directly** (easy to do if setup highlighted that number), or  
- You called **571** but the carrier **did not pass** forward/diversion metadata on the leg to the toll-free ingress (common gap we have to handle separately).

Voicemail can still record (and may show `forwardedTo: 571-477-6175` from other context) while **SMS eligibility** still requires forward evidence on the capture path.

---

## Earlier call (~23:51 UTC)

- Capture job was queued; workers were down (full disk / Redis).
- Manual replay created a missed call **ELIGIBLE** / **SCHEDULED** but send never completed while BullMQ was broken.

---

## What should happen for a new workspace

1. Provision a **dedicated toll-free ingress** from the pool (`pickTelnyxTollFreeIngressE164`) — **not** `platform_mctb_sender`.
2. Show that number only as **“forward unanswered calls here.”**
3. Use **platform sender** (or workspace-verified number) **only** for outbound recovery SMS.
4. Live test: call **business line**, not ingress; verify forward + recovery text.

---

## What to do now (practical)

1. **Test by calling 571-477-6175**, let it forward/no-answer — **do not call 866** for a production test.
2. **`ws_1` needs an ingress/sender split** (ops/product): assign a non–platform-sender toll-free as ingress; keep 866 (or another approved sender) for SMS only; update `missedCallTextConfig.phoneNumberId` and setup forward target.
3. If forward from 571 still yields `NOT_FORWARD_EVENT`, we need a **carrier diversion / TeXML** fix so `forwardedFromE164` is populated on CFNA to toll-free.

---

*Evidence: production DB `missed_call_events`, `phone_numbers.settingsJson`, `telnyx-toll-free-ingress-pool.ts`, `eligibility.ts` (`NOT_FORWARD_EVENT`).*
