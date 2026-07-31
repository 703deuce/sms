import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";

function escapeCsv(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const contacts = await getPrisma().contact.findMany({
      where: { workspaceId: auth.workspaceId },
      include: { tagMembers: { include: { tag: true } } },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "firstName",
      "lastName",
      "phone",
      "email",
      "status",
      "company",
      "tags",
      "consentSource",
      "createdAt",
    ];

    const rows = contacts.map((c: {
      firstName: string | null;
      lastName: string | null;
      phone: string;
      email: string | null;
      status: string;
      company: string | null;
      consentSource: string | null;
      createdAt: Date;
      tagMembers: Array<{ tag: { name: string } }>;
    }) => {
      const tags = c.tagMembers.map((tm) => tm.tag.name).join(";");
      return [
        c.firstName || "",
        c.lastName || "",
        c.phone,
        c.email || "",
        c.status,
        c.company || "",
        tags,
        c.consentSource || "",
        c.createdAt.toISOString(),
      ]
        .map((v) => escapeCsv(String(v)))
        .join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const filename = `contacts-${auth.workspaceId}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}
