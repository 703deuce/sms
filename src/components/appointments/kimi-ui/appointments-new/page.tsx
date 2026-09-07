"use client";

import { useState } from "react";
import { AppointmentForm } from "./components/appointment-form";
import "./reference.css";

export default function ReferencePage() {
  const [createdId, setCreatedId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <AppointmentForm createdId={createdId} onCreated={setCreatedId} onReset={() => setCreatedId(null)} />
    </div>
  );
}
