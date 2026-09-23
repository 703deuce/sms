/**
 * MCTB simplified launch — customer-facing feature gates.
 * Call Handling (PR #483) is separate; do not use this for ingress ownership.
 */

/** Customer-facing Try It / synthetic demo surfaces (nav, onboarding demo CTAs). */
export const MCTB_LAUNCH_TRY_IT_ENABLED = false;

/** Team notifications: email only in setup UI and delivery for launch. */
export const MCTB_LAUNCH_EMAIL_NOTIFICATIONS_ONLY = true;

/** Hide conversational AI booking / AI_BOOK controls in normal MCTB setup. */
export const MCTB_LAUNCH_HIDE_AI_BOOK_UI = true;

/** Hide Text-to-Pay scenario and payment policy on AI Lead Recovery (out of scope for launch). */
export const MCTB_LAUNCH_HIDE_LR_TEXT_TO_PAY_UI = true;

/** Hide AI_BOOK booking modes on AI Lead Recovery; launch uses SEND_BOOKING_LINK only. */
export const MCTB_LAUNCH_HIDE_LR_AI_BOOK_UI = true;

/** Hide read-only / misleading max-attempt and follow-up editor affordances. */
export const MCTB_LAUNCH_SIMPLIFY_RECOVERY_UI = true;

/** Primary recovery UX is goal + template preview; composer is advanced-only. */
export const MCTB_LAUNCH_GOAL_DRIVEN_RECOVERY_UI = true;
