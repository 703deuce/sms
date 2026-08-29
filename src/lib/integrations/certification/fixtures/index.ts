import type { CertProviderId } from "../types";

export type IntegrationFixture = {
  id: string;
  description: string;
  eventType?: string;
  payload: Record<string, unknown>;
};

function withCertCorrelation(
  payload: Record<string, unknown>,
  certRunId: string,
  nameField = "title",
): Record<string, unknown> {
  const out = { ...payload };
  const stamp = certRunId.replace(/^cert_/, "").slice(0, 8);
  const label = `[TRANSOVO CERT] ${stamp}`;
  if (nameField in out && typeof out[nameField] === "string") {
    out[nameField] = `${label} ${out[nameField]}`;
  } else {
    out.certRunId = certRunId;
    out.certLabel = label;
  }
  return out;
}

export function fixturesForProvider(
  provider: CertProviderId,
  certRunId: string,
): IntegrationFixture[] {
  switch (provider) {
    case "pipedrive":
      return [
        {
          id: "pipedrive.person.added",
          description: "Person created webhook",
          eventType: "person.added",
          payload: withCertCorrelation(
            {
              meta: { action: "added", object: "person", id: 900001 },
              current: {
                id: 900001,
                first_name: "Cert",
                last_name: "Lead",
                email: [{ value: "cert-lead@transovo.test" }],
                phone: [{ value: "+15550001111" }],
              },
            },
            certRunId,
            "first_name",
          ),
        },
        {
          id: "pipedrive.deal.updated",
          description: "Deal stage change webhook",
          eventType: "deal.updated",
          payload: withCertCorrelation(
            {
              meta: { action: "updated", object: "deal", id: 900002 },
              current: {
                id: 900002,
                title: "Deal",
                stage_id: 2,
                status: "open",
                value: 100,
              },
              previous: { stage_id: 1 },
            },
            certRunId,
          ),
        },
      ];
    case "calendly":
      return [
        {
          id: "calendly.invitee.created",
          description: "Booking created",
          eventType: "invitee.created",
          payload: {
            event: "invitee.created",
            payload: {
              email: "cert-calendly@transovo.test",
              name: `[TRANSOVO CERT] ${certRunId}`,
              uri: `https://api.calendly.com/scheduled_events/cert/${certRunId}`,
              event: "https://api.calendly.com/event_types/cert",
            },
            certRunId,
          },
        },
        {
          id: "calendly.invitee.canceled",
          description: "Booking canceled",
          eventType: "invitee.canceled",
          payload: {
            event: "invitee.canceled",
            payload: {
              email: "cert-calendly@transovo.test",
              name: `[TRANSOVO CERT] cancel ${certRunId}`,
              uri: `https://api.calendly.com/scheduled_events/cert/${certRunId}`,
            },
            certRunId,
          },
        },
      ];
    case "zoho":
      return [
        {
          id: "zoho.contact.insert",
          description: "Contact created",
          eventType: "contact.insert",
          payload: withCertCorrelation(
            {
              module: "Contacts",
              operation: "insert",
              ids: ["900003"],
              data: {
                First_Name: "Cert",
                Last_Name: "Contact",
                Email: "cert-zoho@transovo.test",
                Phone: "+15550002222",
              },
              certRunId,
            },
            certRunId,
            "First_Name",
          ),
        },
        {
          id: "zoho.deal.update",
          description: "Deal updated",
          eventType: "deal.update",
          payload: {
            module: "Deals",
            operation: "update",
            ids: ["900004"],
            data: { Stage: "Proposal", Deal_Name: `[TRANSOVO CERT] ${certRunId}` },
            certRunId,
          },
        },
      ];
    case "salesforce":
      return [
        {
          id: "salesforce.contact.create",
          description: "Contact CDC create",
          eventType: "contact.created",
          payload: {
            schema: "Contact",
            payload: {
              ChangeEventHeader: {
                entityName: "Contact",
                changeType: "CREATE",
                recordIds: ["003CERT001"],
              },
              FirstName: `[TRANSOVO CERT] ${certRunId}`,
              LastName: "Contact",
              Email: "cert-sf@transovo.test",
            },
            certRunId,
          },
        },
        {
          id: "salesforce.opportunity.update",
          description: "Opportunity stage change",
          eventType: "deal.updated",
          payload: {
            schema: "Opportunity",
            payload: {
              ChangeEventHeader: {
                entityName: "Opportunity",
                changeType: "UPDATE",
                recordIds: ["006CERT001"],
              },
              Name: `[TRANSOVO CERT] ${certRunId}`,
              StageName: "Qualification",
            },
            certRunId,
          },
        },
      ];
    case "jotform":
      return [
        {
          id: "jotform.submission",
          description: "Form submission",
          eventType: "form.submitted",
          payload: {
            formID: "cert-form",
            submissionID: certRunId,
            rawRequest: {
              q3_name: `[TRANSOVO CERT] ${certRunId}`,
              q4_email: "cert-jotform@transovo.test",
              q5_phone: "+15550003333",
            },
            certRunId,
          },
        },
      ];
    default:
      return [];
  }
}
