import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import {
  resolveManageAppointmentByToken,
  manageAppointmentReschedule,
  manageAppointmentCancel,
} from "@/lib/appointments/service-booking";
import {
  getManageAppointmentIntakeContext,
  saveManageAppointmentIntake,
} from "@/lib/appointments/service-booking/manage-intake";
import {
  createManageAppointmentPaymentCheckout,
  getManageAppointmentPaymentSummary,
} from "@/lib/appointments/service-booking/manage-payments";
import { buildPublicAppointmentCustomerPreview } from "@/lib/appointments";
import { loadAppointmentResourceLabels } from "@/lib/appointments/service-booking/resource-availability";

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveManageAppointmentByToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

    const { workspaceId } = resolved.token;
    const appointmentId = resolved.appointment.id;
    const permissions = (resolved.token.permissions || {}) as Record<string, boolean>;

    const [payment, intakeForms] = await Promise.all([
      getManageAppointmentPaymentSummary(workspaceId, appointmentId),
      permissions.editIntake
        ? getManageAppointmentIntakeContext(workspaceId, appointmentId)
        : Promise.resolve([]),
    ]);

    const meta = (resolved.appointment.metadata || {}) as { resourceIds?: string[] };
    const resourceLabels = await loadAppointmentResourceLabels(
      workspaceId,
      meta.resourceIds || [],
    );
    const preview = buildPublicAppointmentCustomerPreview(resolved.appointment);
    if (resourceLabels.length) preview.resources = resourceLabels;

    return NextResponse.json({
      data: {
        ...preview,
        permissions,
        payment,
        intakeForms,
        contactId: resolved.appointment.contactId || null,
      },
    });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { token } = await params;
    const resolved = await resolveManageAppointmentByToken(token);
    if (!resolved) return NextResponse.json({ error: "Invalid or expired link" }, { status: 404 });

    const body = await request.json();
    const { workspaceId } = resolved.token;
    const appointmentId = resolved.appointment.id;
    const permissions = (resolved.token.permissions || {}) as Record<string, boolean>;

    if (body.action === "cancel") {
      if (!permissions.cancel) {
        return NextResponse.json({ error: "Cancellation is not allowed for this link" }, { status: 403 });
      }
      const scope = body.recurringScope ? String(body.recurringScope) : undefined;
      const meta = (resolved.appointment.metadata || {}) as { recurringSeriesId?: string };
      if (scope && meta.recurringSeriesId) {
        const { editRecurringSeries } = await import(
          "@/lib/appointments/service-booking/recurring-series"
        );
        const editScope =
          scope === "future"
            ? "this_and_future"
            : scope === "all"
              ? "entire_series"
              : "this_only";
        await editRecurringSeries(
          workspaceId,
          meta.recurringSeriesId,
          editScope,
          appointmentId,
          { status: "cancelled" },
        );
        const refreshed = await resolveManageAppointmentByToken(token);
        const updated = refreshed?.appointment || resolved.appointment;
        const payment = await getManageAppointmentPaymentSummary(workspaceId, appointmentId);
        return NextResponse.json({
          data: {
            ...buildPublicAppointmentCustomerPreview(updated),
            permissions,
            payment,
            recurringScope: scope,
          },
        });
      }
      const updated = await manageAppointmentCancel(workspaceId, appointmentId, body.cancellationPolicy);
      const payment = await getManageAppointmentPaymentSummary(workspaceId, appointmentId);
      return NextResponse.json({
        data: {
          ...buildPublicAppointmentCustomerPreview(updated),
          permissions,
          payment,
        },
      });
    }

    if (body.action === "reschedule" && body.startsAt) {
      if (!permissions.reschedule) {
        return NextResponse.json({ error: "Reschedule is not allowed for this link" }, { status: 403 });
      }
      const result = await manageAppointmentReschedule(
        workspaceId,
        appointmentId,
        body.startsAt,
        body.reschedulePolicy,
      );
      const payment = await getManageAppointmentPaymentSummary(workspaceId, appointmentId);
      return NextResponse.json({
        data: {
          ...buildPublicAppointmentCustomerPreview(result.appointment),
          permissions,
          payment,
          afterCutoff: result.afterCutoff,
        },
      });
    }

    if (body.action === "pay_balance") {
      if (!permissions.payBalance) {
        return NextResponse.json({ error: "Payment is not allowed for this link" }, { status: 403 });
      }
      const checkout = await createManageAppointmentPaymentCheckout(
        workspaceId,
        appointmentId,
        body.email ? String(body.email) : undefined,
      );
      if (!checkout.required) {
        const payment = await getManageAppointmentPaymentSummary(workspaceId, appointmentId);
        return NextResponse.json({ data: { payment, paid: true } });
      }
      if (!checkout.checkoutUrl) {
        return NextResponse.json(
          { error: checkout.error || "Payment checkout is not available" },
          { status: 400 },
        );
      }
      return NextResponse.json({ data: { checkoutUrl: checkout.checkoutUrl } });
    }

    if (body.action === "save_intake" && body.formId && body.answers) {
      if (!permissions.editIntake) {
        return NextResponse.json({ error: "Intake editing is not allowed for this link" }, { status: 403 });
      }
      await saveManageAppointmentIntake(workspaceId, appointmentId, {
        formId: String(body.formId),
        answers: body.answers as Record<string, unknown>,
        contactId: body.contactId ? String(body.contactId) : undefined,
      });
      const intakeForms = await getManageAppointmentIntakeContext(workspaceId, appointmentId);
      return NextResponse.json({ data: { intakeForms, saved: true } });
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  } catch (err) {
    return jsonError(err, 400);
  }
}
