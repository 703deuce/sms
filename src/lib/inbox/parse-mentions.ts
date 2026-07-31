export type MentionableUser = { id: string; name: string };

/** Parse @Name mentions against workspace team members (case-insensitive). */
export function parseMentionsFromNote(
  body: string,
  teamMembers: MentionableUser[],
): MentionableUser[] {
  const mentioned: MentionableUser[] = [];
  const seen = new Set<string>();
  const sorted = [...teamMembers].sort((a, b) => b.name.length - a.name.length);

  for (const member of sorted) {
    if (!member.name.trim()) continue;
    const escaped = member.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`@${escaped}(?![\\w])`, "i");
    if (pattern.test(body) && !seen.has(member.id)) {
      seen.add(member.id);
      mentioned.push(member);
    }
  }
  return mentioned;
}
