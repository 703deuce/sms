/** Web Mercator helpers aligned with Google Static Maps. */

const TILE = 256;

export function latLngToWorld(lat: number, lng: number): { x: number; y: number } {
  const sinY = Math.sin((lat * Math.PI) / 180);
  const y = 0.5 - Math.log((1 + sinY) / (1 - sinY)) / (4 * Math.PI);
  const x = lng / 360 + 0.5;
  return { x: x * TILE, y: y * TILE };
}

export function latLngToPixel(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  zoom: number,
  width: number,
  height: number
): { x: number; y: number } {
  const scale = 2 ** zoom;
  const center = latLngToWorld(centerLat, centerLng);
  const point = latLngToWorld(lat, lng);
  return {
    x: (point.x - center.x) * scale + width / 2,
    y: (point.y - center.y) * scale + height / 2,
  };
}

/** Choose a zoom that fits the grid radius in the map viewport. */
export function zoomForRadiusMeters(radiusMeters: number, mapWidthPx: number): number {
  // metres per pixel at zoom z, equator ≈ 156543.03392 / 2^z
  const targetMetersPerPx = (radiusMeters * 2.2) / Math.max(mapWidthPx, 1);
  const z = Math.log2(156543.03392 / Math.max(targetMetersPerPx, 0.5));
  return Math.max(10, Math.min(18, Math.floor(z)));
}

export function gridPointSpacingMeters(gridSize: number, radiusMeters: number): number {
  if (gridSize <= 1) return 0;
  return (2 * radiusMeters) / (gridSize - 1);
}
