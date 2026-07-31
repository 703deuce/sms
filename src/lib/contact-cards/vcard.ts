export type ContactCardInput = {
  businessName: string;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  address?: string | null;
  logoUrl?: string | null;
};

export function buildVCard(input: ContactCardInput): string {
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${input.businessName}`,
    `ORG:${input.businessName}`,
  ];
  if (input.phone) lines.push(`TEL;TYPE=WORK,VOICE:${input.phone}`);
  if (input.email) lines.push(`EMAIL;TYPE=WORK:${input.email}`);
  if (input.website) lines.push(`URL:${input.website}`);
  if (input.address) lines.push(`ADR;TYPE=WORK:;;${input.address.replace(/\n/g, " ")}`);
  if (input.logoUrl) lines.push(`PHOTO;VALUE=URI:${input.logoUrl}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}
