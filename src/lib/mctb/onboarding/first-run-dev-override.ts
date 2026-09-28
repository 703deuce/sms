/**
 * Development-only override: set env `MCTB_DEV_FIRST_RUN_WIZARD_EVERY_LOGIN=1`
 * to force the first-run wizard on every `/mctb` visit. Never enable in production deploy config.
 */
export function isMctbDevFirstRunWizardEveryLogin(): boolean {
  return process.env.MCTB_DEV_FIRST_RUN_WIZARD_EVERY_LOGIN === "1";
}
