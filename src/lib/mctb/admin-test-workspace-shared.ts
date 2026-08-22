export type AdminMctbTestFlags = {
  adminTestAccount: boolean;
  unlimitedMctbTesting: boolean;
  adminUnlimitedMctb: boolean;
};

export function isAdminMctbTestWorkspace(flags: AdminMctbTestFlags): boolean {
  return flags.adminTestAccount || flags.unlimitedMctbTesting || flags.adminUnlimitedMctb;
}
