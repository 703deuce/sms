import type { AppointmentCandidate, FindAppointmentIdentity } from "./appointment-types";

function digits(s: string): string {
  return s.replace(/\D/g, "");
}

function normalizePhone(s: string): string {
  const d = digits(s);
  if (d.length === 11 && d.startsWith("1")) return d.slice(1);
  return d;
}

/** Pure scoring for unit tests and candidate ranking. */
export function rankAppointmentCandidates(
  candidates: AppointmentCandidate[],
  identity: FindAppointmentIdentity,
): AppointmentCandidate[] {
  const name = identity.name?.trim().toLowerCase();
  const email = identity.email?.trim().toLowerCase();
  const phone = identity.phone ? normalizePhone(identity.phone) : "";
  const ani = identity.inboundAni ? normalizePhone(identity.inboundAni) : "";
  const service = identity.service?.trim().toLowerCase();

  const scored = candidates.map((c) => {
    let score = 0;
    const title = c.title.toLowerCase();
    if (name && title.includes(name)) score += 3;
    if (email && c.attendeeEmail?.toLowerCase() === email) score += 5;
    if (email && c.attendeeEmail?.toLowerCase().includes(email)) score += 2;
    const cPhone = c.attendeePhone ? normalizePhone(c.attendeePhone) : "";
    if (phone && cPhone && cPhone === phone) score += 4;
    if (ani && cPhone && cPhone === ani) score += 2;
    if (service && title.includes(service)) score += 2;
    return { c, score };
  });

  return scored
    .filter((x) => x.score > 0 || (!name && !email && !phone && !service))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.c);
}

export function selectionIdFor(index: number, providerEventId: string): string {
  return `appt_${index}_${providerEventId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}
