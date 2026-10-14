export type ScanDeviceProfile = {
  device: "desktop" | "mobile";
  language?: string;
};

export const DEFAULT_SCAN_PROFILE: ScanDeviceProfile = { device: "desktop" };
export const MAPS_LANGUAGE = "en";
export const MAPS_LIVE_ENDPOINT = "maps_live";
