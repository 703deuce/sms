import type { PersonalVoicemailMessage } from "@/lib/personal/voicemail-mappers";

export type VoicemailInboxSort = "newest" | "oldest";

export function sortVoicemailMessages(
  messages: PersonalVoicemailMessage[],
  sort: VoicemailInboxSort,
): PersonalVoicemailMessage[] {
  const copy = [...messages];
  copy.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return sort === "newest" ? tb - ta : ta - tb;
  });
  return copy;
}

export function voicemailMinutesThisMonth(messages: PersonalVoicemailMessage[]): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const sec = messages
    .filter((m) => new Date(m.createdAt) >= start)
    .reduce((sum, m) => sum + (m.durationSec != null && m.durationSec > 0 ? m.durationSec : 0), 0);
  return Math.round(sec / 60);
}

export function formatVoicemailDuration(sec: number | null | undefined): string {
  if (sec == null || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function voicemailPrimaryLine(
  callerDisplayName?: string | null,
  callerNumber?: string | null,
  formatPhoneFn: (p: string) => string = (p) => p,
): string {
  const name = (callerDisplayName || "").trim();
  if (name && name.toLowerCase() !== "unknown") return name;
  if (callerNumber && callerNumber !== "Unknown") return formatPhoneFn(callerNumber);
  return "Unknown caller";
}

export function voicemailSecondaryPhoneLine(
  callerDisplayName?: string | null,
  callerNumber?: string | null,
  formatPhoneFn: (p: string) => string = (p) => p,
): string | null {
  const name = (callerDisplayName || "").trim();
  const hasName = name && name.toLowerCase() !== "unknown";
  if (!callerNumber || callerNumber === "Unknown") return hasName ? null : null;
  if (hasName) return formatPhoneFn(callerNumber);
  return null;
}

export function formatVoicemailListTime(createdAt: string): string {
  const d = new Date(createdAt);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  const datePart = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const timePart = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

export function formatVoicemailDetailWhen(createdAt: string): string {
  const d = new Date(createdAt);
  return `${d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}
