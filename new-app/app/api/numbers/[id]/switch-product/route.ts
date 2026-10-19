import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/server/api-error";
import { switchNumberToProduct } from "@/lib/server/telephony/switch-product";
import { resolveWorkspaceId } from "@/lib/server/workspace";

const bodySchema = z.object({
  targetProduct: z.enum(["phone", "receptionist", "mctb", "sms"]),
  confirmSwitch: z.boolean().optional().default(false),
  agentId: z.string().optional().nullable(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const workspaceId = await resolveWorkspaceId();
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const result = await switchNumberToProduct({
      workspaceId,
      phoneNumberId: id,
      targetProduct: parsed.data.targetProduct,
      confirmSwitch: parsed.data.confirmSwitch,
      agentId: parsed.data.agentId,
    });

    if (result.needsConfirmation) {
      return NextResponse.json(
        {
          error: "confirm_switch_required",
          data: result,
        },
        { status: 409 },
      );
    }

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "switch_failed", data: result }, { status: 422 });
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    return jsonError(err, 400);
  }
}
