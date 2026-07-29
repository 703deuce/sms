import twilio from "twilio";
import { getTestModeSender } from "./twilio-config";

/**
 * Test-mode SMS sender. Two strategies (see getTestModeSender):
 *
 * 1. Simulated API test — Twilio TEST credentials + magic sender (+15005550006).
 *    Real message SID, no carrier delivery, no charge, no A2P. Magic destination
 *    numbers simulate outcomes (e.g. +15005550001 → invalid number 21211).
 * 2. Virtual Phone / live sender — live credentials + a real owned Twilio number,
 *    sending `to` the Twilio Virtual Phone (+18777804236) to test end-to-end
 *    without A2P (message appears in the Console's Virtual Phone, not a real device).
 *
 * No statusCallback is set: neither strategy needs a localhost callback URL (which
 * Twilio would reject), and test credentials do not fire delivery callbacks.
 */
export const twilioTestAdapter = {
  async sendSms(input: { to: string; body: string }) {
    const { accountSid, authToken, from } = getTestModeSender();
    const client = twilio(accountSid, authToken);
    const msg = await client.messages.create({
      to: input.to,
      from,
      body: input.body,
    });
    return { sid: msg.sid, status: msg.status, to: msg.to };
  },
};
