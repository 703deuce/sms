import type { PaymentProvider, PaymentProviderCapabilities } from "./types";

const BLOCKED_PROTOCOLS = /^(javascript|data|vbscript):/i;

const APPROVED_STRIPE_HOSTS = new Set([
  "buy.stripe.com",
  "checkout.stripe.com",
  "pay.stripe.com",
  "invoice.stripe.com",
  "donate.stripe.com",
  "billing.stripe.com",
]);

const APPROVED_PAYPAL_HOSTS = new Set([
  "paypal.me",
  "www.paypal.me",
  "paypal.com",
  "www.paypal.com",
]);

const APPROVED_VENMO_HOSTS = new Set([
  "venmo.com",
  "www.venmo.com",
  "account.venmo.com",
]);

const APPROVED_CASHAPP_HOSTS = new Set([
  "cash.app",
  "www.cash.app",
]);

export type BuildDestinationInput = {
  publicHandle?: string | null;
  publicUrl?: string | null;
  amountCents?: number;
  note?: string | null;
};

export type BuildDestinationResult = {
  destinationUrl: string | null;
  fallbackInstructions: string;
  opensInNewTab: boolean;
  /** Zelle: show manual copy UI instead of opening a link */
  manualFlow: boolean;
};

export type PaymentProviderDefinition = {
  providerKey: PaymentProvider;
  displayName: string;
  buttonLabel: string;
  brandColor: string;
  capabilities: PaymentProviderCapabilities;
  validateInput: (input: string) => { ok: true; normalized: string } | { ok: false; error: string };
  normalizeInput: (input: string) => string;
  buildDestination: (input: BuildDestinationInput) => BuildDestinationResult;
};

function stripHandle(input: string): string {
  return input.trim().replace(/^[@$]/, "");
}

function isSafeHttpUrl(url: string, allowedHosts?: Set<string>): boolean {
  if (!url || BLOCKED_PROTOCOLS.test(url)) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    if (allowedHosts && !allowedHosts.has(parsed.hostname.toLowerCase())) return false;
    return true;
  } catch {
    return false;
  }
}

function formatDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

function primaryInput(input: BuildDestinationInput): string {
  const url = (input.publicUrl ?? "").trim();
  if (url) return url;
  return (input.publicHandle ?? "").trim();
}

export const STRIPE_PROVIDER: PaymentProviderDefinition = {
  providerKey: "stripe",
  displayName: "Stripe",
  buttonLabel: "Pay with Card or Apple Pay",
  brandColor: "#635BFF",
  capabilities: {
    supportsExternalLink: true,
    supportsPrefilledAmount: false,
    supportsPrefilledNote: false,
    supportsVerifiedCompletion: false,
  },
  normalizeInput: (input) => input.trim(),
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Stripe Payment Link URL is required." };
    if (!trimmed.startsWith("http")) {
      return { ok: false, error: "Paste the full Stripe Payment Link URL (https://...)." };
    }
    if (!isSafeHttpUrl(trimmed, APPROVED_STRIPE_HOSTS)) {
      return {
        ok: false,
        error: "URL must be a Stripe-hosted payment link (buy.stripe.com, checkout.stripe.com, etc.).",
      };
    }
    return { ok: true, normalized: trimmed };
  },
  buildDestination: (input) => {
    const raw = primaryInput(input);
    const validated = STRIPE_PROVIDER.validateInput(raw);
    if (!validated.ok) {
      return {
        destinationUrl: null,
        fallbackInstructions: "Open your Stripe payment page.",
        opensInNewTab: true,
        manualFlow: false,
      };
    }
    return {
      destinationUrl: validated.normalized,
      fallbackInstructions: "Complete payment on Stripe.",
      opensInNewTab: true,
      manualFlow: false,
    };
  },
};

export const CASH_APP_PROVIDER: PaymentProviderDefinition = {
  providerKey: "cash_app",
  displayName: "Cash App",
  buttonLabel: "Pay with Cash App",
  brandColor: "#00D632",
  capabilities: {
    supportsExternalLink: true,
    supportsPrefilledAmount: true,
    supportsPrefilledNote: true,
    supportsVerifiedCompletion: false,
  },
  normalizeInput: (input) => {
    const trimmed = input.trim();
    if (trimmed.startsWith("http")) return trimmed;
    const handle = stripHandle(trimmed);
    return handle ? `$${handle}` : "";
  },
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Cash App payment link or Cashtag is required." };
    if (trimmed.startsWith("http")) {
      if (!isSafeHttpUrl(trimmed, APPROVED_CASHAPP_HOSTS)) {
        return { ok: false, error: "Cash App URL must be from cash.app." };
      }
      return { ok: true, normalized: trimmed };
    }
    const handle = stripHandle(trimmed);
    if (!/^[a-zA-Z0-9_]{1,20}$/.test(handle)) {
      return { ok: false, error: "Invalid Cash App Cashtag." };
    }
    return { ok: true, normalized: `$${handle}` };
  },
  buildDestination: (input) => {
    const raw = primaryInput(input);
    const validated = CASH_APP_PROVIDER.validateInput(raw);
    if (!validated.ok) {
      return {
        destinationUrl: null,
        fallbackInstructions: "Open Cash App to complete payment.",
        opensInNewTab: true,
        manualFlow: false,
      };
    }
    const normalized = validated.normalized;
    const amountCents = input.amountCents;
    const note = input.note?.trim();

    if (normalized.startsWith("http") && isSafeHttpUrl(normalized, APPROVED_CASHAPP_HOSTS)) {
      const url = new URL(normalized);
      if (amountCents && amountCents > 0) {
        url.searchParams.set("amount", formatDollars(amountCents));
      }
      if (note) url.searchParams.set("note", note.slice(0, 200));
      return {
        destinationUrl: url.toString(),
        fallbackInstructions: "Open Cash App to complete payment.",
        opensInNewTab: true,
        manualFlow: false,
      };
    }

    const handle = stripHandle(normalized);
    let dest = `https://cash.app/${handle}`;
    if (amountCents && amountCents > 0) {
      dest = `${dest}/${formatDollars(amountCents)}`;
    }
    return {
      destinationUrl: dest,
      fallbackInstructions: `Open Cash App and send to $${handle}`,
      opensInNewTab: true,
      manualFlow: false,
    };
  },
};

export const VENMO_PROVIDER: PaymentProviderDefinition = {
  providerKey: "venmo",
  displayName: "Venmo",
  buttonLabel: "Pay with Venmo",
  brandColor: "#008CFF",
  capabilities: {
    supportsExternalLink: true,
    supportsPrefilledAmount: true,
    supportsPrefilledNote: true,
    supportsVerifiedCompletion: false,
  },
  normalizeInput: (input) => {
    const trimmed = input.trim();
    if (trimmed.startsWith("http")) return trimmed;
    return stripHandle(trimmed);
  },
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Venmo username or URL is required." };
    if (trimmed.startsWith("http")) {
      if (!isSafeHttpUrl(trimmed, APPROVED_VENMO_HOSTS)) {
        return { ok: false, error: "Venmo URL must be from venmo.com." };
      }
      return { ok: true, normalized: trimmed };
    }
    const username = stripHandle(trimmed);
    if (!/^[a-zA-Z0-9_-]{3,30}$/.test(username)) {
      return { ok: false, error: "Invalid Venmo username." };
    }
    return { ok: true, normalized: username };
  },
  buildDestination: (input) => {
    const raw = primaryInput(input);
    const validated = VENMO_PROVIDER.validateInput(raw);
    if (!validated.ok) {
      return {
        destinationUrl: null,
        fallbackInstructions: "Open Venmo to complete payment.",
        opensInNewTab: true,
        manualFlow: false,
      };
    }
    const normalized = validated.normalized;
    const amountCents = input.amountCents;
    const note = input.note?.trim();

    if (normalized.startsWith("http") && isSafeHttpUrl(normalized, APPROVED_VENMO_HOSTS)) {
      const url = new URL(normalized);
      if (amountCents && amountCents > 0) {
        url.searchParams.set("txn", "pay");
        url.searchParams.set("amount", formatDollars(amountCents));
      }
      if (note) url.searchParams.set("note", note.slice(0, 200));
      return {
        destinationUrl: url.toString(),
        fallbackInstructions: "Open Venmo to complete payment.",
        opensInNewTab: true,
        manualFlow: false,
      };
    }

    const username = stripHandle(normalized);
    const params = new URLSearchParams({ txn: "pay" });
    if (amountCents && amountCents > 0) params.set("amount", formatDollars(amountCents));
    if (note) params.set("note", note.slice(0, 200));
    return {
      destinationUrl: `https://venmo.com/${encodeURIComponent(username)}?${params.toString()}`,
      fallbackInstructions: `Open Venmo and pay @${username}`,
      opensInNewTab: true,
      manualFlow: false,
    };
  },
};

export const PAYPAL_PROVIDER: PaymentProviderDefinition = {
  providerKey: "paypal",
  displayName: "PayPal",
  buttonLabel: "Pay with PayPal",
  brandColor: "#003087",
  capabilities: {
    supportsExternalLink: true,
    supportsPrefilledAmount: true,
    supportsPrefilledNote: false,
    supportsVerifiedCompletion: false,
  },
  normalizeInput: (input) => input.trim(),
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "PayPal.me URL is required." };
    if (!trimmed.startsWith("http")) {
      const paypalPath = trimmed.match(
        /^(?:paypal\.me\/|www\.paypal\.me\/)([a-zA-Z0-9._-]{1,50})$/i
      );
      if (paypalPath) {
        return { ok: true, normalized: `https://paypal.me/${paypalPath[1]}` };
      }
      const handle = stripHandle(trimmed);
      if (!/^[a-zA-Z0-9._-]{1,50}$/.test(handle)) {
        return { ok: false, error: "Invalid PayPal.me handle." };
      }
      return { ok: true, normalized: `https://paypal.me/${handle}` };
    }
    if (!isSafeHttpUrl(trimmed, APPROVED_PAYPAL_HOSTS)) {
      return { ok: false, error: "PayPal URL must be from paypal.me or paypal.com." };
    }
    return { ok: true, normalized: trimmed };
  },
  buildDestination: (input) => {
    const raw = primaryInput(input);
    const validated = PAYPAL_PROVIDER.validateInput(raw);
    if (!validated.ok) {
      return {
        destinationUrl: null,
        fallbackInstructions: "Open PayPal to complete payment.",
        opensInNewTab: true,
        manualFlow: false,
      };
    }
    let url = validated.normalized;
    const amountCents = input.amountCents;
    if (amountCents && amountCents > 0) {
      const parsed = new URL(url);
      parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/${formatDollars(amountCents)}`;
      url = parsed.toString();
    }
    return {
      destinationUrl: url,
      fallbackInstructions: "Open PayPal to complete payment.",
      opensInNewTab: true,
      manualFlow: false,
    };
  },
};

export const ZELLE_PROVIDER: PaymentProviderDefinition = {
  providerKey: "zelle",
  displayName: "Zelle",
  buttonLabel: "Pay with Zelle",
  brandColor: "#6D1ED4",
  capabilities: {
    supportsExternalLink: false,
    supportsPrefilledAmount: false,
    supportsPrefilledNote: false,
    supportsVerifiedCompletion: false,
  },
  normalizeInput: (input) => input.trim(),
  validateInput: (input) => {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, error: "Zelle email or phone is required." };
    if (trimmed.startsWith("http")) {
      return { ok: false, error: "Zelle does not support URL links. Enter email or phone." };
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    const phoneOk = /^\+?[\d\s().-]{7,20}$/.test(trimmed);
    if (!emailOk && !phoneOk) {
      return { ok: false, error: "Enter a valid Zelle email or phone number." };
    }
    return { ok: true, normalized: trimmed };
  },
  buildDestination: (input) => {
    const raw = primaryInput(input);
    const validated = ZELLE_PROVIDER.validateInput(raw);
    const recipient = validated.ok ? validated.normalized : raw;
    return {
      destinationUrl: null,
      fallbackInstructions: `Send via Zelle to: ${recipient}`,
      opensInNewTab: false,
      manualFlow: true,
    };
  },
};

export const PAYMENT_PROVIDER_MAP: Record<PaymentProvider, PaymentProviderDefinition> = {
  stripe: STRIPE_PROVIDER,
  cash_app: CASH_APP_PROVIDER,
  venmo: VENMO_PROVIDER,
  paypal: PAYPAL_PROVIDER,
  zelle: ZELLE_PROVIDER,
};

export function getPaymentProvider(provider: PaymentProvider): PaymentProviderDefinition {
  return PAYMENT_PROVIDER_MAP[provider];
}

export function getPaymentProviderCapabilities(
  provider: PaymentProvider
): PaymentProviderCapabilities {
  return getPaymentProvider(provider).capabilities;
}

export function validatePaymentMethodInput(
  provider: PaymentProvider,
  input: string
): { ok: true; normalized: string } | { ok: false; error: string } {
  return getPaymentProvider(provider).validateInput(input);
}

export function buildPaymentDestination(
  provider: PaymentProvider,
  input: BuildDestinationInput
): BuildDestinationResult {
  return getPaymentProvider(provider).buildDestination(input);
}

export function isBlockedUrl(url: string): boolean {
  return BLOCKED_PROTOCOLS.test(url.trim());
}

export const APPROVED_STRIPE_PAYMENT_LINK_HOSTS = APPROVED_STRIPE_HOSTS;
