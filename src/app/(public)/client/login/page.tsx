import Link from "next/link";

export default function ClientPortalLoginIndexPage() {
  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-semibold">Client sign-in</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Open the sign-in link from your booking confirmation, or visit your business&apos;s client portal URL.
      </p>
      <p className="mt-4 text-sm">
        Example: <code className="rounded bg-muted px-1">/client/your-business-slug</code>
      </p>
      <Link href="/book" className="mt-6 inline-block text-sm underline">Find a business to book</Link>
    </main>
  );
}
