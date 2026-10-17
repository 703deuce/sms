import { jsonError } from "@/lib/api-auth";
import { getPrisma } from "@/lib/db";
import { resolveShareByToken } from "@/lib/visualizer/share";
import { normalizeE164 } from "@/lib/messaging/twilio-mappings";

export async function POST(req: Request) {
  const body = (await req.json()) as {
    slug?: string;
    shareToken?: string;
    projectId?: string;
    designId?: string;
    fullName?: string;
    phone?: string;
    email?: string;
    serviceZip?: string;
    notes?: string;
  };

  if (!body.slug || !body.fullName?.trim() || !body.phone?.trim()) {
    return jsonError("slug, fullName, and phone required", 400);
  }

  const prisma = getPrisma();
  let workspaceId: string;
  let projectId = body.projectId || "";
  let designId = body.designId || null;

  if (body.shareToken) {
    const resolved = await resolveShareByToken(body.slug, body.shareToken);
    if (!resolved) return jsonError("Invalid share link", 404);
    if (!resolved.share.allowEstimateRequest) {
      return jsonError("Estimate requests are not enabled for this preview.", 403);
    }
    workspaceId = resolved.share.workspaceId;
    projectId = resolved.share.projectId;
    designId = resolved.share.designId;
  } else {
    const widget = await prisma.visualizerWidgetConfig.findFirst({
      where: { publicSlug: body.slug, published: true },
    });
    if (!widget || !projectId) return jsonError("Invalid estimate request", 400);
    workspaceId = widget.workspaceId;
  }

  const phone = normalizeE164(body.phone.trim());

  let contact = await prisma.contact.findFirst({
    where: { workspaceId, phone },
  });
  if (!contact) {
    const parts = body.fullName.trim().split(/\s+/);
    contact = await prisma.contact.create({
      data: {
        workspaceId,
        phone,
        firstName: parts[0] || body.fullName.trim(),
        lastName: parts.slice(1).join(" ") || null,
        email: body.email?.trim() || null,
        consentSource: "visualizer_estimate",
      },
    });
  }

  const estimate = await prisma.visualizerEstimateRequest.create({
    data: {
      workspaceId,
      projectId,
      designId,
      contactId: contact.id,
      fullName: body.fullName.trim(),
      phone,
      email: body.email?.trim() || null,
      serviceZip: body.serviceZip?.trim() || null,
      notes: body.notes?.trim() || null,
      status: "NEW",
      source: body.shareToken ? "share" : "hosted",
    },
  });

  await prisma.visualizerProject.update({
    where: { id: projectId },
    data: { status: "ESTIMATE_REQUESTED", contactId: contact.id },
  });

  await prisma.visualizerEvent.create({
    data: {
      workspaceId,
      projectId,
      eventType: "estimate_requested",
      actorType: "customer",
      metadata: { estimateId: estimate.id, contactId: contact.id },
    },
  });

  return Response.json({ estimateId: estimate.id, ok: true });
}
