export function isSuccessfulAiRunStatus(status: string): boolean {
  return status === "completed" || status === "success";
}
