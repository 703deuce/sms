# AI Rescheduler — required end-to-end addendum

This document is the implementation addendum referenced alongside the main Cursor build instruction. **Do not treat as a new audit** — apply during implementation.

Sections A–I from the product addendum are implemented incrementally on branch `cursor/ar-ai-rescheduler-implement-f350`. See `docs/AR-AI-RESCHEDULER-IMPLEMENTATION-STATUS.md` for current completion.

## Product rule (explicit)

**C / R / X appear on reminder SMS for all workspaces with AR SMS enabled** (`notify` or `ai`). Workspace settings control **what happens after**:

| Reply | Notify-only | AI automatic | AI + business approval |
|-------|-------------|--------------|------------------------|
| C | Confirm in Transovo (+ provider annotate when supported) | Same | Same |
| R | Reschedule **request** to business | AI conversation → calendar update | AI conversation → approval queue |
| X | Cancellation policy + YES confirm; provider cancel only when enabled | Same | Same |

**X is not an unconditional delete** — cancellation policy and YES confirmation apply.
