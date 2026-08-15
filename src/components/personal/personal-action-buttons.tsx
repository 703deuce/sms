"use client";

import { Button } from "@/components/ui/button";
import { runPersonalNumberAction } from "@/lib/personal/client-actions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PersonalParkButton({
  numberId,
  label = "Park",
  variant = "outline" as const,
  size = "sm" as const,
  className,
}: {
  numberId: string;
  label?: string;
  variant?: "outline" | "primary" | "ghost";
  size?: "sm" | "default";
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function park() {
    if (!window.confirm("Park this number in your vault? Call forwarding will be turned off.")) return;
    setLoading(true);
    setError(null);
    try {
      await runPersonalNumberAction(numberId, "park");
      router.push("/personal/vault");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not park number.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <Button size={size} variant={variant} disabled={loading} onClick={park}>
        {loading ? "Parking…" : label}
      </Button>
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}

export function KeepWithTransovoButton({ numberId }: { numberId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function keep() {
    setLoading(true);
    try {
      await runPersonalNumberAction(numberId, "keep");
      setDone(true);
      router.refresh();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button size="sm" variant="outline" disabled={loading || done} onClick={keep}>
      {done ? "Kept with Transovo" : loading ? "Saving…" : "Keep With Transovo"}
    </Button>
  );
}
