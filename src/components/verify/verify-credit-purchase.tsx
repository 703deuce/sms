"use client";

const packs = [
  { key: "verify_1000", label: "1,000 credits", price: "$9.99" },
  { key: "verify_5000", label: "5,000 credits", price: "$19.99" },
  { key: "verify_10000", label: "10,000 credits", price: "$34.99" },
  { key: "verify_50000", label: "50,000 credits", price: "$99.00" },
];

export function VerifyCreditPurchase() {
  async function buy(productKey: string) {
    const res = await fetch("/api/verify/credits/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productKey, returnPath: "/verify/billing" }),
    });
    const json = await res.json();
    if (json.data?.url) window.location.href = json.data.url;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {packs.map((pack) => (
        <button
          key={pack.key}
          type="button"
          onClick={() => buy(pack.key)}
          className="rounded-lg border p-4 text-left hover:bg-muted"
        >
          <p className="font-semibold">{pack.label}</p>
          <p className="text-sm text-muted-foreground">{pack.price}</p>
        </button>
      ))}
    </div>
  );
}
