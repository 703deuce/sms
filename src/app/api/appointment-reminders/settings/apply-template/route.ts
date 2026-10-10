import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-auth";
import { requireAppointmentRemindersAccess } from "@/lib/appointment-reminders/api-auth";
import { applyAppointmentRemindersPlatformTemplatePolicy } from "@/lib/appointment-reminders/platform-template-policy";
import { getLibraryTemplateByParts } from "@/lib/appointment-reminders/template-library/catalog";
import type { TemplateMessageType } from "@/lib/appointment-reminders/template-library/types";
import {
  loadAppointmentPlatformConfig,
  saveAppointmentPlatformConfig,
} from "@/lib/appointments/settings";
import { listReminderStepIds, resolveReminderStep } from "@/lib/appointments/reminders/reminders-config";

export async function POST(request: Request) {
  try {
    const auth = await requireAppointmentRemindersAccess("appointment_reminders.settings");
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      stepKey?: string;
      industry?: string;
      messageType?: TemplateMessageType;
      channel?: "sms" | "email";
    };
    if (!body.stepKey || !body.industry || !body.messageType) {
      return NextResponse.json(
        { error: "stepKey, industry, and messageType are required" },
        { status: 400 },
      );
    }
    const channel = body.channel === "email" ? "email" : "sms";
    const entry = getLibraryTemplateByParts(body.industry, body.messageType, channel);
    if (!entry) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    const current = await loadAppointmentPlatformConfig(auth.workspaceId);
    const keys = listReminderStepIds(current);
    if (!keys.includes(body.stepKey)) {
      return NextResponse.json({ error: "Invalid reminder step" }, { status: 400 });
    }

    const step = resolveReminderStep(current, body.stepKey);
    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    const nextStep = {
      ...step,
      template: entry.body,
      emailSubject: entry.subject ?? step.emailSubject,
      libraryIndustry: body.industry,
      libraryMessageType: body.messageType,
      channel,
    };

    const reminders = { ...current.reminders };
    if (body.stepKey === "confirmation") reminders.confirmation = nextStep;
    else if (body.stepKey === "reminder24h") reminders.reminder24h = nextStep;
    else if (body.stepKey === "reminder2h") reminders.reminder2h = nextStep;
    else {
      reminders.additionalSteps = (reminders.additionalSteps || []).map((s) =>
        s.id === body.stepKey ? { ...s, ...nextStep } : s,
      );
    }

    const policyPatch = await applyAppointmentRemindersPlatformTemplatePolicy(auth.workspaceId, {
      reminders,
      reminderPreferences: {
        ...current.reminderPreferences,
        templateIndustry: body.industry,
      },
    });
    const data = await saveAppointmentPlatformConfig(auth.workspaceId, policyPatch);
    return NextResponse.json({ data });
  } catch (err) {
    return jsonError(err, 400);
  }
}
