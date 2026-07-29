import twilio from "twilio";
import { assertTestTwilioConfigured, getTestFromNumber } from "./twilio-config";

/**
 * Test-mode SMS sender.
 *
 * Uses Twilio **test credentials** (TWILIO_TEST_ACCOUNT_SID / TWILIO_TEST_AUTH_TOKEN)
 * and the magic sender number (+15005550006) to hit the real Twilio Messages API.
 * Twilio returns a simulated response — a real message SID with no carrier delivery,
 * no charge, and no A2P / number-purchase requirement.
 *
 * Twilio "magic" destination numbers can be passed as `to` to simulate outcomes, e.g.:
 *   +15005550006  valid, delivered (as sender)      +15005550001  invalid number (21211)
 *   +15005550009  cannot receive SMS (21408)        +15005550004  no international permission
 *
 * No statusCallback is set: test credentials do not fire delivery callbacks, and a
 * localhost callback URL would be rejected by Twilio.
 */
export const twilioTestAdapter = {
  async sendSms(input: { to: string; body: string }) {
    const { accountSid, authToken } = assertTestTwilioConfigured();
    const client = twilio(accountSid, authToken);
    const msg = await client.messages.create({
      to: input.to,
      from: getTestFromNumber(),
      body: input.body,
    });
    return { sid: msg.sid, status: msg.status, to: msg.to };
  },
};
