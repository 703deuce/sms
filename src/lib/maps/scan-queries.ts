export async function loadScanGridData(_scanId: string): Promise<unknown> {
  return { cells: [], entities: [] };
}

export async function loadLocationScanSummaries(_locationId: string): Promise<unknown[]> {
  return [];
}
