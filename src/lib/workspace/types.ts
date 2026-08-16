export type WorkspaceType = "PERSONAL" | "BUSINESS";

export type WorkspaceFeature =
  | "number_search"
  | "premium_search"
  | "buy_number"
  | "number_vault"
  | "forwarding"
  | "voicemail"
  | "port_in"
  | "port_out"
  | "call_logs"
  | "ai_agent"
  | "smart_routing"
  | "business_sms"
  | "a2p"
  | "campaigns"
  | "automations"
  | "crm_contacts"
  | "appointments"
  | "integrations";

export type PersonalServiceState =
  | "PARKED"
  | "PARKED_VOICEMAIL"
  | "FORWARDING"
  | "VOICEMAIL"
  | "PORTING_IN"
  | "PORTING_OUT"
  | "PORT_AWAY_WINDOW"
  | "ACTIVE";

export type PersonalAcquisitionType = "PURCHASED" | "PORTED_IN" | "PREMIUM_PURCHASE";
