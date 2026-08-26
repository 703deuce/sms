export type MassTextingStripeCatalogIds = {
  monthly: Record<
    "starter" | "growth" | "pro" | "business" | "scale",
    { stripePriceId: string }
  >;
  payg_line: { stripePriceId: string };
  payg_packs: Record<
    "pack_500" | "pack_1000" | "pack_2500" | "pack_5000" | "pack_10000",
    { stripePriceId: string }
  >;
  a2p_registration: { stripePriceId: string };
  additional_number: { stripePriceId: string };
  stripeProductId: string;
};
