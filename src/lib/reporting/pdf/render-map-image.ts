import sharp from "sharp";
import { rankHex, rankTextColor } from "@/lib/maps/colors";
import {
  apiKeySuffix,
  getGoogleMapsApiKey,
  getGoogleMapsApiKeySource,
} from "@/lib/maps/google-maps-key";
import { logger } from "@/lib/observability/logger";
import { gridPointSpacingMeters, latLngToPixel, zoomForRadiusMeters } from "@/lib/reporting/pdf/mercator";
import { rankLabel, svgDigitLabel } from "@/lib/reporting/pdf/svg-digits";

export type MapCellPin = {
  lat: number;
  lng: number;
  rank: number | null;
  label?: string;
};

export type RenderMapResult = {
  buffer: Buffer;
  mapSource: "google_static" | "blank_fallback";
  width: number;
  height: number;
  bytes: number;
  generationMs: number;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function svgBubble(rank: number | null, cx: number, cy: number, r: number): string {
  const color = rankHex(rank);
  const { r: red, g, b } = hexToRgb(color);
  const text = rankLabel(rank);
  // Path digits — do not use <text>; Coolify/workers often lack SVG fonts.
  const ink = rankTextColor(color);
  const digitSize = text.length > 1 ? r * 1.05 : r * 1.25;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="rgb(${red},${g},${b})" stroke="#fff" stroke-width="2"/>
    ${svgDigitLabel({ text, cx, cy, size: digitSize, color: ink })}`;
}

async function blankMapBase(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 241, g: 245, b: 249 },
    },
  })
    .png()
    .toBuffer();
}

async function fetchStaticMapBase(params: {
  apiKey: string;
  centerLat: number;
  centerLng: number;
  zoom: number;
  width: number;
  height: number;
  withStyle: boolean;
}): Promise<{ ok: true; buffer: Buffer } | { ok: false; status: number; body: string }> {
  // Static Maps allows max 640px per side; scale=2 doubles the returned pixels.
  // Preserve the requested aspect ratio inside that budget (no stretch-to-square).
  const maxSide = 640;
  const aspect = params.width / Math.max(1, params.height);
  let reqW: number;
  let reqH: number;
  if (aspect >= 1) {
    reqW = maxSide;
    reqH = Math.max(1, Math.round(maxSide / aspect));
  } else {
    reqH = maxSide;
    reqW = Math.max(1, Math.round(maxSide * aspect));
  }

  const url = new URL("https://maps.googleapis.com/maps/api/staticmap");
  url.searchParams.set("center", `${params.centerLat},${params.centerLng}`);
  url.searchParams.set("zoom", String(params.zoom));
  url.searchParams.set("size", `${reqW}x${reqH}`);
  url.searchParams.set("scale", "2");
  url.searchParams.set("maptype", "roadmap");
  if (params.withStyle) {
    url.searchParams.set("style", "feature:poi|visibility:off");
  }
  url.searchParams.set("key", params.apiKey);

  const res = await fetch(url.toString(), {
    signal: AbortSignal.timeout(25_000),
    headers: { Accept: "image/*" },
    redirect: "follow",
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 300);
    return { ok: false, status: res.status, body };
  }
  const raw = Buffer.from(await res.arrayBuffer());
  const buffer = await sharp(raw)
    .resize(params.width, params.height, { fit: "fill" })
    .png()
    .toBuffer();
  return { ok: true, buffer };
}

/**
 * Build a high-res map PNG: Google Static Maps base + rank bubbles composited via sharp.
 * When `requireRealMap` is true, Static Maps failure throws (no silent gray PDF maps).
 */
export async function renderScanMapPng(params: {
  centerLat: number;
  centerLng: number;
  radiusMeters: number;
  gridSize: number;
  pins: MapCellPin[];
  width?: number;
  height?: number;
  /** When true, do not fall back to a blank gray base — fail the export. */
  requireRealMap?: boolean;
}): Promise<RenderMapResult> {
  const started = Date.now();
  const width = params.width ?? 1280;
  const height = params.height ?? 1280;
  const zoom = zoomForRadiusMeters(params.radiusMeters, width);
  const apiKey = getGoogleMapsApiKey();
  const keySource = getGoogleMapsApiKeySource();
  const requireRealMap = Boolean(params.requireRealMap);

  let base: Buffer;
  let mapSource: RenderMapResult["mapSource"] = "blank_fallback";

  if (!apiKey) {
    logger.warn("static_maps_missing_key", { keySource });
    if (requireRealMap) {
      throw new Error(
        "Google Static Maps key is not configured on this worker (set MAPS or GOOGLE_MAPS_STATIC_API_KEY). PDF/map exports require a real map image."
      );
    }
    base = await blankMapBase(width, height);
  } else {
    try {
      let result = await fetchStaticMapBase({
        apiKey,
        centerLat: params.centerLat,
        centerLng: params.centerLng,
        zoom,
        width,
        height,
        withStyle: false,
      });
      if (!result.ok) {
        logger.warn("static_maps_http_retry_styled", {
          status: result.status,
          body: result.body,
          keySource,
          keySuffix: apiKeySuffix(apiKey),
        });
        result = await fetchStaticMapBase({
          apiKey,
          centerLat: params.centerLat,
          centerLng: params.centerLng,
          zoom,
          width,
          height,
          withStyle: true,
        });
      }
      if (!result.ok) {
        logger.warn("static_maps_http_fallback", {
          status: result.status,
          body: result.body,
          keySource,
          keySuffix: apiKeySuffix(apiKey),
        });
        if (requireRealMap) {
          throw new Error(
            `Google Static Maps failed (HTTP ${result.status}). ${result.body.slice(0, 180)} Ensure Maps Static API is allowed on this key (API restrictions).`
          );
        }
        base = await blankMapBase(width, height);
      } else {
        base = result.buffer;
        mapSource = "google_static";
      }
    } catch (err) {
      if (requireRealMap) throw err;
      logger.warn("static_maps_fetch_fallback", {
        error: err instanceof Error ? err.message : String(err),
        keySource,
        keySuffix: apiKeySuffix(apiKey),
      });
      base = await blankMapBase(width, height);
    }
  }

  const bubbleR = Math.max(10, Math.min(22, Math.floor(width / (params.gridSize * 2.8))));
  const bubbles = params.pins
    .map((pin) => {
      const { x, y } = latLngToPixel(
        pin.lat,
        pin.lng,
        params.centerLat,
        params.centerLng,
        zoom,
        width,
        height
      );
      if (x < -bubbleR || y < -bubbleR || x > width + bubbleR || y > height + bubbleR) {
        return "";
      }
      return svgBubble(pin.rank, x, y, bubbleR);
    })
    .join("\n");

  const centerPx = latLngToPixel(
    params.centerLat,
    params.centerLng,
    params.centerLat,
    params.centerLng,
    zoom,
    width,
    height
  );
  const centerMark = `<circle cx="${centerPx.x}" cy="${centerPx.y}" r="7" fill="#111827" stroke="#fff" stroke-width="2"/>`;

  const spacing = Math.round(gridPointSpacingMeters(params.gridSize, params.radiusMeters));
  const legendY = height - 36;
  // Swatch + path digits only (no <text> — missing fonts on workers strip labels).
  const legend = `
    <rect x="16" y="${legendY - 22}" width="300" height="48" rx="8" fill="rgba(255,255,255,0.92)" stroke="#e4e4e7"/>
    <circle cx="40" cy="${legendY - 2}" r="10" fill="#0B7A29" stroke="#fff" stroke-width="1.5"/>
    ${svgDigitLabel({ text: "1", cx: 40, cy: legendY - 2, size: 11, color: "#ffffff" })}
    <circle cx="78" cy="${legendY - 2}" r="10" fill="#EAA92B" stroke="#fff" stroke-width="1.5"/>
    ${svgDigitLabel({ text: "8", cx: 78, cy: legendY - 2, size: 11, color: "#111827" })}
    <circle cx="116" cy="${legendY - 2}" r="10" fill="#A81810" stroke="#fff" stroke-width="1.5"/>
    ${svgDigitLabel({ text: "20", cx: 116, cy: legendY - 2, size: 10, color: "#ffffff" })}
    <circle cx="154" cy="${legendY - 2}" r="10" fill="#71717a" stroke="#fff" stroke-width="1.5"/>
    ${svgDigitLabel({ text: "-", cx: 154, cy: legendY - 2, size: 11, color: "#ffffff" })}
    ${svgDigitLabel({ text: String(Math.min(spacing, 9999)), cx: 230, cy: legendY - 2, size: 11, color: "#3f3f46" })}`;

  const overlay = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    ${bubbles}
    ${centerMark}
    ${legend}
  </svg>`);

  const buffer = await sharp(base)
    .composite([{ input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const generationMs = Date.now() - started;
  logger.info("scan_map_image_ready", {
    map_source: mapSource,
    map_image_bytes: buffer.byteLength,
    map_width: width,
    map_height: height,
    map_generation_ms: generationMs,
    keySource,
    keySuffix: apiKey ? apiKeySuffix(apiKey) : null,
  });

  return {
    buffer,
    mapSource,
    width,
    height,
    bytes: buffer.byteLength,
    generationMs,
  };
}
