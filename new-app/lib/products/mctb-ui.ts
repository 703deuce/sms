/** Launch gate: standalone MCTB product nav and Phone MCTB surfaces (on by default). */
export const MCTB_UI_ENABLED =
  process.env.NEXT_PUBLIC_MCTB_UI_ENABLED !== "0" &&
  process.env.MCTB_UI_ENABLED !== "0";
