/** Telnyx-first MCTB ingress — same front door as proven AI TeXML path. */
export const MCTB_TEXML_ROUTING_MODE = "mctb_texml" as const;
export const MCTB_TEXML_ROUTING_OWNER = "mctb_texml" as const;
export const MCTB_TEXML_CONSENT_PATH = "texml_mctb_ingress" as const;

/** Certification stages — ?cert=A|B|C|D on Telnyx voice_url (or MCTB_TEXML_CERT_MODE env). Default D. */
export type MctbTexmlCertMode = "A" | "B" | "C" | "D";

export type MctbTexmlIngressBranch = "mctb" | "ai_assistant";
