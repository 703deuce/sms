/** Telnyx-first MCTB ingress — same front door as proven AI TeXML path. */
export const MCTB_TEXML_ROUTING_MODE = "mctb_texml" as const;
export const MCTB_TEXML_ROUTING_OWNER = "mctb_texml" as const;
export const MCTB_TEXML_DEFAULT_APP_ID = "3037587396909598261";
export const MCTB_TEXML_CONSENT_PATH = "texml_mctb_ingress" as const;

/** Certified TeXML app — same for 866, 571, and every MCTB DID. Never per-mode apps. */
export function resolveFrozenMctbTexmlAppId(override?: string | null): string {
  return (
    override?.trim() ||
    process.env.MCTB_TEXML_APP_ID?.trim() ||
    MCTB_TEXML_DEFAULT_APP_ID
  );
}

/** Certification stages — ?cert=A|B|B2|B3|C|C3|D on Telnyx voice_url. Default D. */
export type MctbTexmlCertMode = "A" | "B" | "B2" | "B3" | "C" | "C3" | "D";

export type MctbTexmlIngressBranch = "mctb" | "ai_assistant";
