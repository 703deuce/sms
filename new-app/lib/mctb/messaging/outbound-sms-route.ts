/** Minimal outbound route shape for platform-sender assignment gate (Phone-owned MCTB). */
export type MctbOutboundSmsRoute = {
  senderMode: "PLATFORM" | "WORKSPACE";
  fromE164: string;
  phoneNumberId: string;
};
