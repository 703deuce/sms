"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function NewAutomationPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Untitled automation" }),
    })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to create automation");
        router.replace(`/automations/${json.data.id}/edit`);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to create"));
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
      {error ? <p className="text-rose-600">{error}</p> : "Creating new automation…"}
    </div>
  );
}
