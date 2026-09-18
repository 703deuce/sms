export default function VoiceOperationsPage() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold">Voice operations</h1>
      <p className="mt-4 text-muted-foreground">
        The Voice V2 operations console was removed with the legacy booking agent. Missed-call
        recovery and appointment booking for the receptionist use{" "}
        <strong>Voice V3 Basic</strong> (OpenAI Live + deterministic Microsoft calendar runtime).
      </p>
      <p className="mt-2 text-muted-foreground">
        Configure the receptionist in Setup; route PSTN through the Voice V3 Basic Telnyx webhook.
      </p>
    </main>
  );
}
