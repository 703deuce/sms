export type PersonalNumberAction =
  | "park"
  | "reactivate"
  | "keep"
  | "enable_voicemail"
  | "disable_voicemail";

export async function runPersonalNumberAction(numberId: string, action: PersonalNumberAction) {
  const res = await fetch(`/api/personal/numbers/${numberId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : "Could not update this number.",
    );
  }
  return json.data;
}
