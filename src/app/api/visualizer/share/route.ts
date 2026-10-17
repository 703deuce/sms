import { jsonError, requireSession } from "@/lib/api-auth";
import { createVisualizerShare } from "@/lib/visualizer/share";
import { sendQuickSms } from "@/lib/sms/send-quick";

export async function POST(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const body = (await req.json()) as {
    projectId?: string;
    designId?: string;
    sendSms?: boolean;
    phone?: string;
    expiresInDays?: number;
  };

  if (!body.projectId || !body.designId) {
    return jsonError("projectId and designId required", 400);
  }

  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + body.expiresInDays * 86400_000)
      : null;

  const { shareId, url } = await createVisualizerShare({
    workspaceId: auth.workspaceId,
    projectId: body.projectId,
    designId: body.designId,
    createdByUserId: auth.session.userId,
    expiresAt,
  });

  let smsResult: unknown = null;
  if (body.sendSms && body.phone?.trim()) {
    const message = `Your bathroom remodel preview is ready. View your design: ${url}`;
    try {
      smsResult = await sendQuickSms({
        workspaceId: auth.workspaceId,
        to: body.phone.trim(),
        body: message,
        omitConsumerTrackingLink: true,
      });
    } catch (e) {
      return Response.json({
        shareId,
        url,
        smsError: e instanceof Error ? e.message : "SMS send failed",
      });
    }
  }

  return Response.json({ shareId, url, smsResult });
}
