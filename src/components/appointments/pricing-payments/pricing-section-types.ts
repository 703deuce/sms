import {
  BadgePercent,
  ClipboardList,
  CreditCard,
  Gift,
  IdCard,
  Receipt,
  ShoppingBag,
  Wallet,
} from "lucide-react";

export const PRICING_SECTIONS = [
  { id: "overview", label: "Overview", description: "Payment readiness and checkout preview.", icon: ClipboardList },
  { id: "collection", label: "Payment collection", description: "Default modes and per-offering overrides.", icon: Wallet },
  { id: "deposits", label: "Deposits & balances", description: "Deposit defaults and remaining balance.", icon: CreditCard },
  { id: "packages", label: "Packages & memberships", description: "How prepaid access participates in checkout.", icon: Gift },
  { id: "discounts", label: "Discounts & taxes", description: "Promo codes and tax configuration.", icon: BadgePercent },
  { id: "refunds", label: "Refunds & policies", description: "Refunds, cancellation and failures.", icon: Receipt },
  { id: "providers", label: "Payment providers", description: "Stripe Connect and Square status.", icon: ShoppingBag },
  { id: "checkout", label: "Checkout experience", description: "Customer-facing payment preview.", icon: IdCard },
] as const;

export type PricingSectionId = (typeof PRICING_SECTIONS)[number]["id"];
