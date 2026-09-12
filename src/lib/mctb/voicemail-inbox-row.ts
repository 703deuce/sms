import { formatPhone } from "@/lib/utils";
import type { PersonalVoicemailMessage } from "@/lib/personal/voicemail-mappers";
import { formatVoicemailDuration } from "@/lib/mctb/voicemail-display";

export type VoicemailInboxRowModel = {
  primary: string;
  secondary: string | null;
  transcriptPreview: string | null;
  timeLabel: string;
  durationLabel: string;
  isUnread: boolean;
};

/** Canonical inbox hierarchy — never duplicate the same phone on two lines. */
export function buildVoicemailInboxRowModel(
  m: PersonalVoicemailMessage,
  timeLabel: string,
): VoicemailInboxRowModel {
  const name = (m.callerDisplayName || "").trim();
  const hasContactName = Boolean(name && name.toLowerCase() !== "unknown");
  const phone =
    m.callerNumber && m.callerNumber !== "Unknown" ? formatPhone(m.callerNumber) : null;

  let primary: string;
  let secondary: string | null;

  if (hasContactName) {
    primary = name;
    secondary = phone;
  } else if (phone) {
    primary = phone;
    secondary = "Unknown caller";
  } else {
    primary = "Unknown caller";
    secondary = null;
  }

  const transcriptPreview = (m.transcript || "").trim() || null;

  return {
    primary,
    secondary,
    transcriptPreview,
    timeLabel,
    durationLabel: formatVoicemailDuration(m.durationSec),
    isUnread: !m.isRead,
  };
}
