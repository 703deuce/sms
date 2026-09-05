import "server-only";

import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { buildParticipantContext } from "./participant-context";

const PASSCODE_ROUNDS = 10;

export function generatePublicMeetingToken(): string {
  return randomBytes(24).toString("hex");
}

export async function hashMeetingPasscode(passcode: string): Promise<string> {
  return bcrypt.hash(passcode.trim(), PASSCODE_ROUNDS);
}

export async function verifyMeetingPasscode(
  passcode: string,
  passcodeHash: string | null | undefined,
): Promise<boolean> {
  if (!passcodeHash) return true;
  if (!passcode.trim()) return false;
  return bcrypt.compare(passcode.trim(), passcodeHash);
}

export { buildParticipantContext, parseParticipantContext } from "./participant-context";
