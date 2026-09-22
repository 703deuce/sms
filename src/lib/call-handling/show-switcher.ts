/** When both MCTB and Voice (AI Receptionist) are entitled on the workspace. */
export function shouldShowCallHandlingSwitcher(input: {
  hasMctb: boolean;
  hasVoice: boolean;
}): boolean {
  return Boolean(input.hasMctb && input.hasVoice);
}
