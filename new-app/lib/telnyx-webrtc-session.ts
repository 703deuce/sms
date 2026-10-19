/**
 * One TelnyxRTC client per browser tab (Telnyx webrtc-demo-js pattern).
 * Duplicate clients → duplicate WebSocket registrations → SDK warning 33007
 * (DUPLICATE_INBOUND_ANSWER): answer() ignored, no server call.answered.
 */
import type { TelnyxRTC } from "@telnyx/webrtc";

type Client = InstanceType<typeof TelnyxRTC>;

export type TelnyxSdkNotification = {
  type?: string;
  call?: {
    id?: string;
    state?: string;
    direction?: string;
    remoteCallerNumber?: string;
    localCallerNumber?: string;
    sipReason?: string;
    cause?: string;
    answer?: (opts?: { remoteElement?: HTMLMediaElement }) => void | Promise<void>;
    hangup?: () => void;
  };
};

let sharedClient: Client | null = null;
let sharedLoginToken: string | null = null;
let connectInFlight: Promise<Client> | null = null;

const notificationHandlers = new Set<(n: TelnyxSdkNotification) => void>();
const readyHandlers = new Set<() => void>();
const errorHandlers = new Set<(err: unknown) => void>();
const warningHandlers = new Set<(event: unknown) => void>();

function attachClientListeners(client: Client) {
  const tagged = client as { __transovoTelnyxListeners?: boolean };
  if (tagged.__transovoTelnyxListeners) return;
  tagged.__transovoTelnyxListeners = true;

  client.on("telnyx.ready", () => {
    for (const h of readyHandlers) h();
  });
  client.on("telnyx.error", (err: unknown) => {
    for (const h of errorHandlers) h(err);
  });
  client.on("telnyx.warning", (event: unknown) => {
    for (const h of warningHandlers) h(event);
  });
  client.on("telnyx.notification", (notification: TelnyxSdkNotification) => {
    for (const h of notificationHandlers) h(notification);
  });
}

export function getSharedTelnyxClient(): Client | null {
  return sharedClient;
}

export function sharedClientLoginToken(): string | null {
  return sharedLoginToken;
}

export function subscribeTelnyxNotifications(handler: (n: TelnyxSdkNotification) => void) {
  notificationHandlers.add(handler);
  return () => notificationHandlers.delete(handler);
}

export function subscribeTelnyxReady(handler: () => void) {
  readyHandlers.add(handler);
  return () => readyHandlers.delete(handler);
}

export function subscribeTelnyxError(handler: (err: unknown) => void) {
  errorHandlers.add(handler);
  return () => errorHandlers.delete(handler);
}

export function subscribeTelnyxWarning(handler: (event: unknown) => void) {
  warningHandlers.add(handler);
  return () => warningHandlers.delete(handler);
}

/** Reuse an existing connected client when the login token is unchanged. */
export async function ensureTelnyxWebRtcClient(loginToken: string): Promise<Client> {
  if (sharedClient && sharedLoginToken === loginToken) {
    return sharedClient;
  }

  if (sharedClient && sharedLoginToken !== loginToken) {
    try {
      await (sharedClient as { disconnect?: () => Promise<void> }).disconnect?.();
    } catch {
      // ignore
    }
    sharedClient = null;
    sharedLoginToken = null;
  }

  if (connectInFlight) {
    return connectInFlight;
  }

  connectInFlight = (async () => {
    const { TelnyxRTC } = await import("@telnyx/webrtc");
    const client = new TelnyxRTC({ login_token: loginToken });
    sharedClient = client;
    sharedLoginToken = loginToken;
    attachClientListeners(client);
    await client.connect();
    return client;
  })();

  try {
    return await connectInFlight;
  } finally {
    connectInFlight = null;
  }
}

export function lookupSdkCall(
  client: Client | null,
  callId: string,
): TelnyxSdkNotification["call"] | null {
  if (!client || !callId) return null;
  const calls = (client as { calls?: Record<string, TelnyxSdkNotification["call"]> }).calls;
  const fromMap = calls?.[callId];
  if (fromMap) return fromMap;
  return null;
}

type SdkCallWithAnswer = TelnyxSdkNotification["call"] & {
  answer?: (opts?: { remoteElement?: HTMLMediaElement }) => void | Promise<void>;
  hangup?: () => void;
};

/** Authoritative inbound Call handle — never use React state copies for SDK methods. */
export async function resolveInboundSdkCall(
  client: Client | null,
  callId: string,
  inboundRef?: SdkCallWithAnswer | null,
): Promise<SdkCallWithAnswer> {
  const { TelnyxRTC } = await import("@telnyx/webrtc");
  let call: SdkCallWithAnswer | null =
    inboundRef || lookupSdkCall(client, callId) || null;
  if (!call) {
    throw new Error("Call session is no longer available");
  }
  call = TelnyxRTC.telnyxStateCall(
    call as Parameters<typeof TelnyxRTC.telnyxStateCall>[0],
  ) as SdkCallWithAnswer;
  if (typeof call.answer !== "function") {
    throw new Error("Call session is no longer available");
  }
  return call;
}

/** Telnyx Call.answer uses `this.session` — must not be detached from the instance. */
export async function answerInboundSdkCall(
  call: SdkCallWithAnswer,
  options?: { remoteElement?: HTMLMediaElement },
): Promise<void> {
  const answer = call.answer;
  if (typeof answer !== "function") {
    throw new Error("Call session is no longer available");
  }
  await answer.call(call, options);
}

export function hangupSdkCall(call: SdkCallWithAnswer | null | undefined) {
  if (!call?.hangup) return;
  call.hangup.call(call);
}
