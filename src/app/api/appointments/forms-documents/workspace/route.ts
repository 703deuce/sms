import { getPrisma } from "@/lib/db";
import { listAppointmentTypes } from "@/lib/appointments";
import {
  buildAssignmentIndex,
  countAssignmentsPerForm,
  countFilesInAnswers,
  hasSignatureInAnswers,
  inferLibraryKind,
  readFormMetadata,
  requirementsLabel,
  submissionStatus,
  type DocumentRow,
  type LibraryRow,
  type SubmissionRow,
} from "@/lib/appointments/forms-documents/forms-workspace";
import {
  listContractTemplates,
  listIntakeForms,
  listIntakeFormResponses,
} from "@/lib/appointments/service-booking";
import type { IntakeField } from "@/lib/appointments/service-booking/types";
import { withAppointmentsAuth } from "@/lib/appointments/service-booking/api-helpers";

export async function GET() {
  return withAppointmentsAuth("appointments.read", async ({ workspaceId }) => {
    const prisma = getPrisma();
    const [forms, responses, types, contracts, signedContracts] = await Promise.all([
      listIntakeForms(workspaceId, "appointment"),
      listIntakeFormResponses(workspaceId, { limit: 500 }),
      listAppointmentTypes(workspaceId, { includeSecret: true, includeUnlisted: true }).then((rows) =>
        rows.map((t) => ({
          id: t.id,
          name: t.name,
          kind: t.config?.bookingTypeKind || "SERVICE",
          durationMinutes: t.durationMinutes,
          config: t.config,
        })),
      ),
      listContractTemplates(workspaceId),
      prisma.signedBookingContract.findMany({
        where: { workspaceId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    ]);

    const assignments = buildAssignmentIndex(types);
    const assignedCounts = countAssignmentsPerForm(assignments);

    const submissionCounts = new Map<string, number>();
    for (const r of responses) {
      submissionCounts.set(r.formId, (submissionCounts.get(r.formId) || 0) + 1);
    }

    const formById = new Map(forms.map((f) => [f.id, f]));

    const library: LibraryRow[] = forms.map((form) => {
      const fields = (form.fields || []) as IntakeField[];
      const meta = readFormMetadata(form.metadata);
      const kind = inferLibraryKind(fields, meta);
      return {
        id: form.id,
        name: form.name,
        kind,
        fieldCount: fields.length,
        requirementsLabel: requirementsLabel(fields, kind),
        assignedCount: assignedCounts.get(form.id) || 0,
        submissionCount: submissionCounts.get(form.id) || 0,
        active: form.active,
        version: form.version,
        updatedAt: form.updatedAt.toISOString(),
      };
    });

    const appointmentIds = [...new Set(responses.map((r) => r.appointmentId).filter(Boolean))] as string[];
    const contactIds = [...new Set(responses.map((r) => r.contactId).filter(Boolean))] as string[];

    const [appointments, contacts] = await Promise.all([
      appointmentIds.length
        ? prisma.voiceAppointment.findMany({
            where: { workspaceId, id: { in: appointmentIds } },
            select: {
              id: true,
              serviceName: true,
              startsAt: true,
              firstName: true,
              lastName: true,
            },
          })
        : [],
      contactIds.length
        ? prisma.contact.findMany({
            where: { workspaceId, id: { in: contactIds } },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
        : [],
    ]);

    const apptMap = new Map(appointments.map((a) => [a.id, a]));
    const contactMap = new Map(contacts.map((c) => [c.id, c]));

    const submissions: SubmissionRow[] = responses.map((r) => {
      const form = formById.get(r.formId);
      const fields = ((form?.fields || []) as IntakeField[]) || [];
      const answers = (r.answers || {}) as Record<string, unknown>;
      const contact = r.contactId ? contactMap.get(r.contactId) : undefined;
      const appt = r.appointmentId ? apptMap.get(r.appointmentId) : undefined;
      const customerLabel = contact
        ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") || contact.email || "Contact"
        : appt
          ? [appt.firstName, appt.lastName].filter(Boolean).join(" ") || "Customer"
          : "Customer";
      const bookingLabel = appt
        ? `${appt.serviceName || "Appointment"} · ${appt.startsAt.toISOString().slice(0, 10)}`
        : "—";
      const status = submissionStatus(answers, fields);
      return {
        id: r.id,
        formId: r.formId,
        formName: form?.name || "Form",
        customerLabel,
        bookingLabel,
        submittedAt: r.createdAt.toISOString(),
        status: hasSignatureInAnswers(answers, fields) ? "signed" : status,
        filesCount: countFilesInAnswers(answers),
        hasSignature: hasSignatureInAnswers(answers, fields),
        formVersion: r.formVersion,
        contactId: r.contactId || undefined,
        appointmentId: r.appointmentId || undefined,
      };
    });

    const contractCompletions = new Map<string, number>();
    for (const c of signedContracts) {
      if (c.status === "signed") {
        contractCompletions.set(c.templateId, (contractCompletions.get(c.templateId) || 0) + 1);
      }
    }

    const documents: DocumentRow[] = contracts.map((t) => ({
      id: t.id,
      name: t.name,
      kind: "contract",
      signatureRequired: true,
      assignedCount: t.eligibleTypeIds?.length || 0,
      completionsCount: contractCompletions.get(t.id) || 0,
      active: t.active,
      version: t.version,
      updatedAt: t.updatedAt.toISOString(),
    }));

    const intakeDocuments: DocumentRow[] = forms
      .filter((f) => {
        const fields = (f.fields || []) as IntakeField[];
        const kind = inferLibraryKind(fields, readFormMetadata(f.metadata));
        return kind === "waiver" || kind === "agreement";
      })
      .map((f) => ({
        id: f.id,
        name: f.name,
        kind: inferLibraryKind((f.fields || []) as IntakeField[], readFormMetadata(f.metadata)) ===
          "waiver"
          ? "waiver"
          : "contract",
        signatureRequired: ((f.fields || []) as IntakeField[]).some((x) => x.type === "signature"),
        assignedCount: assignedCounts.get(f.id) || 0,
        completionsCount: submissionCounts.get(f.id) || 0,
        active: f.active,
        version: String(f.version),
        updatedAt: f.updatedAt.toISOString(),
      }));

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const submissionsThisMonth = responses.filter((r) => r.createdAt >= monthStart).length;
    const signaturesPending = signedContracts.filter((c) => c.status === "unsigned").length;

    const documentCount = documents.length + intakeDocuments.length;
    const formsCount = library.filter((r) => r.kind === "form" || r.kind === "questionnaire").length;
    const docFormsCount = library.filter((r) => r.kind !== "form" && r.kind !== "questionnaire").length;

    return {
      library,
      assignments,
      submissions,
      documents: [...intakeDocuments, ...documents],
      stats: {
        formsCount,
        documentsCount: docFormsCount + contracts.length,
        assignedLinks: assignments.reduce((n, a) => n + a.formIds.length, 0),
        pendingCompletion: signaturesPending,
        submissionsThisMonth,
        signaturesPending,
        documentCount,
      },
      forms: forms.map((f) => ({
        id: f.id,
        name: f.name,
        fields: f.fields,
        version: f.version,
        active: f.active,
        metadata: f.metadata,
        updatedAt: f.updatedAt.toISOString(),
      })),
      contractTemplates: contracts,
      signedContracts: signedContracts.map((c) => ({
        id: c.id,
        templateId: c.templateId,
        appointmentId: c.appointmentId,
        status: c.status,
        templateVersion: c.templateVersion,
        signedAt: c.signedAt?.toISOString(),
        signerName: c.signerName,
      })),
    };
  });
}
