/** All workspace-owned MCTB numbers use customer production role. */
export async function resolveMctbProvisionRole(_input: {
  phoneNumberId: string;
}): Promise<"customer_mctb"> {
  return "customer_mctb";
}
