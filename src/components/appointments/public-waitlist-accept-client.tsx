"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Check, Loader2, XCircle } from "lucide-react";

export function PublicWaitlistAcceptClient({ token }: { token: string }) {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch(`/api/public/waitlist/accept/${encodeURIComponent(token)}`, { method: "POST" })
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Could not accept offer");
        setStatus("success");
        setMessage("Your appointment is confirmed! You'll receive a confirmation message shortly.");
      })
      .catch((err: Error) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="max-w-md w-full p-8 text-center">
        {status === "loading" ? (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Confirming your slot…</p>
          </>
        ) : status === "success" ? (
          <>
            <Check className="mx-auto h-10 w-10 text-emerald-600" />
            <h1 className="mt-4 font-display text-lg font-semibold">You&apos;re booked!</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </>
        ) : (
          <>
            <XCircle className="mx-auto h-10 w-10 text-rose-600" />
            <h1 className="mt-4 font-display text-lg font-semibold">Offer unavailable</h1>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
          </>
        )}
      </Card>
    </div>
  );
}
