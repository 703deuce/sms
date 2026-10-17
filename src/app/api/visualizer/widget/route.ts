import { jsonError, requireSession } from "@/lib/api-auth";
import { getAppBaseUrl } from "@/lib/messaging/twilio-config";
import { ensureVisualizerWidgetConfig } from "@/lib/visualizer/widget-config";
import { VISUALIZER_PUBLIC_ROUTES } from "@/lib/visualizer/routes";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const config = await ensureVisualizerWidgetConfig(auth.workspaceId);
  const base = getAppBaseUrl().replace(/\/$/, "");

  return Response.json({
    config: {
      ...config,
      hostedUrl: `${base}${VISUALIZER_PUBLIC_ROUTES.hosted(config.publicSlug)}`,
      embedUrl: `${base}${VISUALIZER_PUBLIC_ROUTES.embed(config.publicKey)}`,
      embedSnippet: `<iframe src="${base}${VISUALIZER_PUBLIC_ROUTES.embed(config.publicKey)}" title="Bathroom Visualizer" style="width:100%;min-height:640px;border:0;border-radius:12px" allow="camera"></iframe>`,
    },
  });
}

export async function PATCH(req: Request) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;
  if (!auth.workspaceId) return jsonError("workspaceId required", 400);

  const body = (await req.json()) as Record<string, unknown>;
  await ensureVisualizerWidgetConfig(auth.workspaceId);
  const prisma = getPrisma();

  const config = await prisma.visualizerWidgetConfig.update({
    where: { workspaceId: auth.workspaceId },
    data: {
      ...(typeof body.published === "boolean" ? { published: body.published } : {}),
      ...(body.brandingJson !== undefined ? { brandingJson: body.brandingJson as never } : {}),
      ...(body.limitsJson !== undefined ? { limitsJson: body.limitsJson as never } : {}),
      ...(body.leadCaptureJson !== undefined ? { leadCaptureJson: body.leadCaptureJson as never } : {}),
      ...(Array.isArray(body.publicMaterialIds)
        ? { publicMaterialIds: body.publicMaterialIds as string[] }
        : {}),
      ...(Array.isArray(body.enabledTransformations)
        ? { enabledTransformations: body.enabledTransformations as string[] }
        : {}),
      ...(Array.isArray(body.allowedEmbedDomains)
        ? { allowedEmbedDomains: body.allowedEmbedDomains as string[] }
        : {}),
    },
  });

  return Response.json({ config });
}
