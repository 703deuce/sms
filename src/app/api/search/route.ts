import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

export type SearchResult = {
  id: string;
  type: "contact" | "campaign" | "conversation";
  title: string;
  subtitle: string;
  href: string;
};

const PER_TYPE = 5;

function dedupe<T extends { id: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}

export async function GET(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    if (q.length < 2) {
      return NextResponse.json({ data: [] });
    }

    const prisma = getPrisma();
    const workspaceId = auth.workspaceId;
    const results: SearchResult[] = [];

    // Contacts — search each field independently so the compat layer can use ILIKE.
    const contactQueries = ["firstName", "lastName", "phone", "email"].map((field) =>
      prisma.contact.findMany({
        where: { workspaceId, [field]: { contains: q, mode: "insensitive" } },
        take: PER_TYPE,
      }),
    );
    const contactRows = dedupe(
      (await Promise.all(contactQueries)).flat() as Array<{
        id: string;
        firstName: string | null;
        lastName: string | null;
        phone: string;
        email: string | null;
      }>,
    ).slice(0, PER_TYPE);

    for (const c of contactRows) {
      const name = [c.firstName, c.lastName].filter(Boolean).join(" ") || c.phone;
      results.push({
        id: c.id,
        type: "contact",
        title: name,
        subtitle: c.phone || c.email || "Contact",
        href: `/contacts/${c.id}`,
      });
    }

    // Campaigns — by name.
    const campaignRows = (await prisma.campaign.findMany({
      where: { workspaceId, name: { contains: q, mode: "insensitive" } },
      take: PER_TYPE,
      orderBy: { createdAt: "desc" },
    })) as Array<{ id: string; name: string; status: string }>;
    for (const c of campaignRows) {
      results.push({
        id: c.id,
        type: "campaign",
        title: c.name,
        subtitle: `Campaign · ${c.status}`,
        href: `/campaigns/${c.id}`,
      });
    }

    // Conversations — resolve through matching contacts.
    if (contactRows.length) {
      const convRows = (await prisma.conversation.findMany({
        where: { workspaceId, contactId: { in: contactRows.map((c) => c.id) } },
        take: PER_TYPE,
        orderBy: { updatedAt: "desc" },
        include: { contact: true },
      })) as Array<{
        id: string;
        contact: { firstName: string | null; lastName: string | null; phone: string } | null;
      }>;
      for (const conv of convRows) {
        const name =
          [conv.contact?.firstName, conv.contact?.lastName].filter(Boolean).join(" ") ||
          conv.contact?.phone ||
          "Conversation";
        results.push({
          id: conv.id,
          type: "conversation",
          title: name,
          subtitle: "Conversation",
          href: `/inbox?conversation=${conv.id}`,
        });
      }
    }

    return NextResponse.json({ data: results });
  } catch (err) {
    return jsonError(err, 500);
  }
}
