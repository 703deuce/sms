"use client";

import { CheckCircle2, ArrowRight } from "lucide-react";
import { Segment } from "../mock-data";

export default function SuccessScreen({
  segment,
  onContinue,
}: {
  segment: Segment;
  onContinue: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-8 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-9 w-9 text-emerald-600" />
      </div>
      <h1 className="mt-5 text-2xl font-bold">Segment Saved</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        “<strong>{segment.name}</strong>” was saved successfully and currently matches{" "}
        <strong>{segment.contacts.toLocaleString()}</strong> contacts.
      </p>
      <button onClick={onContinue} className="btn-brand mt-6 flex items-center gap-2 rounded-md px-6 py-2 text-sm font-semibold">
        Continue <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
