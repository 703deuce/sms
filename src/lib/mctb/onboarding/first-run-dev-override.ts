/**
 * Development / QA override: force the first-run wizard on every `/mctb` visit (modal).
 * Env: `MCTB_DEV_FIRST_RUN_WIZARD_EVERY_LOGIN=1` or `MCTB_FIRST_RUN_WIZARD_EVERY_LOGIN=1`.
 * Never enable in production deploy config.
 */
export function isMctbDevFirstRunWizardEveryLogin(): boolean {
  return (
    process.env.MCTB_DEV_FIRST_RUN_WIZARD_EVERY_LOGIN === "1" ||
    process.env.MCTB_FIRST_RUN_WIZARD_EVERY_LOGIN === "1"
  );
}
