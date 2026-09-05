import { NextResponse } from "next/server";
import { requireSession, jsonError } from "@/lib/api-auth";
import { loadAppointmentPlatformConfig } from "@/lib/appointments/settings";
import { renderAppointmentTemplate } from "@/lib/appointments/appointments-service";
import { loadCallerIdSettingsForUi } from "@/lib/appointment-voice-reminders/caller-id";
import {
  loadVoiceRemindersConfig,
  saveVoiceRemindersConfig,
} from "@/lib/appointment-voice-reminders/storage";
import {
  DEFAULT_HUMAN_SCRIPT,
  DEFAULT_VOICEMAIL_SCRIPT,
  type VoiceReminderTemplate,
} from "@/lib/appointment-voice-reminders/types";

const SAMPLE_VARS: Record<string, string> = {
  first_name: "Sarah",
  last_name: "Johnson",
  business_name: "Acme Dental",
  service: "Cleaning",
  staff_name: "Dr. Lee",
  appointment_date: "September 12",
  appointment_time: "2:00 PM",
  appointment_timezone: "America/New_York",
  location: "Main Office",
  address: "123 Main St",
};

export async function GET() {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;

    const [config, callerId, platform] = await Promise.all([
      loadVoiceRemindersConfig(auth.workspaceId),
      loadCallerIdSettingsForUi(auth.workspaceId),
      loadAppointmentPlatformConfig(auth.workspaceId),
    ]);

    return NextResponse.json({
      data: {
        ...config,
        callerId,
        businessPhone: platform.businessPhone || null,
        timezone: platform.timezone,
      },
    });
  } catch (err) {
    return jsonError(err, 500);
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      enabled?: boolean;
      defaultTemplateId?: string;
      templates?: VoiceReminderTemplate[];
      provisionedPhoneNumberId?: string;
      defaultTransferE164?: string;
    };

    const data = await saveVoiceRemindersConfig(auth.workspaceId, body);
    const callerId = await loadCallerIdSettingsForUi(auth.workspaceId);
    return NextResponse.json({ data: { ...data, callerId } });
  } catch (err) {
    return jsonError(err, 400);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireSession();
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as {
      action?: string;
      humanScript?: string;
      voicemailScript?: string;
    };

    if (body.action === "preview") {
      const human = renderAppointmentTemplate(body.humanScript || DEFAULT_HUMAN_SCRIPT, SAMPLE_VARS);
      const voicemail = renderAppointmentTemplate(
        body.voicemailScript || DEFAULT_VOICEMAIL_SCRIPT,
        SAMPLE_VARS,
      );
      return NextResponse.json({ data: { human, voicemail, sampleVars: SAMPLE_VARS } });
    }

    return jsonError(new Error("Unknown action"), 400);
  } catch (err) {
    return jsonError(err, 400);
  }
}
