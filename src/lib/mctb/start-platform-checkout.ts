/** Client helper — start Stripe checkout for platform SKUs (MCTB add-ons, Text Back, etc.). */

export async function startPlatformProductCheckout(input: {
  productKey: string;
  successPath?: string;
  nextProductKey?: string;
}): Promise<void> {
  const res = await fetch("/api/platform/billing/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productKey: input.productKey,
      successPath: input.successPath,
      nextProductKey: input.nextProductKey,
    }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { error?: string }).error || "Checkout failed");
  }
  const url = (json as { data?: { url?: string } }).data?.url;
  if (!url) throw new Error("Checkout URL missing");
  window.location.href = url;
}
