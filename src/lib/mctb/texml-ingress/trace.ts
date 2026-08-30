export type MctbTexmlTraceEvent =
  | "MCTB_INGRESS"
  | "MCTB_TEXML_RETURNED"
  | "MCTB_PROMPT_STARTED"
  | "MCTB_GATHER_STARTED"
  | "MCTB_DTMF_RECEIVED"
  | "MCTB_CONSENT_RECORDED"
  | "MCTB_SMS_QUEUED"
  | "MCTB_SMS_ACCEPTED"
  | "MCTB_CALL_COMPLETED"
  | "MCTB_ROUTING_FAIL";

export function traceMctbTexml(
  event: MctbTexmlTraceEvent,
  fields: Record<string, unknown>,
): void {
  console.log(
    JSON.stringify({
      source: "mctb-texml-ingress",
      trace: event,
      at: new Date().toISOString(),
      ...fields,
    }),
  );
}
