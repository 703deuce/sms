export type ServiceAreaConfig = {
  zipCodes?: string[];
  cities?: string[];
  zones?: Array<{ id: string; name: string; zipCodes?: string[]; cities?: string[] }>;
  radiusMiles?: number | null;
  centerLat?: number | null;
  centerLng?: number | null;
};

export type EligibilityInput = {
  address?: string | null;
  zip?: string | null;
  city?: string | null;
  config: ServiceAreaConfig;
};

export type EligibilityOutcome = {
  status: "in_area" | "out_of_area" | "special_zone" | "unknown";
  zone?: string | null;
  message?: string | null;
  eligibleResourceIds?: string[];
};

function extractZip(text: string): string | null {
  const match = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] || null;
}

function extractCity(text: string): string | null {
  const parts = text.split(",").map((p) => p.trim());
  if (parts.length >= 2) return parts[parts.length - 2] || parts[0] || null;
  return null;
}

export function validateServiceArea(input: EligibilityInput): EligibilityOutcome {
  const address = String(input.address || input.city || "").trim();
  const zip = input.zip || (address ? extractZip(address) : null);
  const city = input.city || (address ? extractCity(address) : null);
  const config = input.config;

  if (!zip && !city && !address) {
    return {
      status: "unknown",
      message: "I need a service address to confirm we can reach you.",
    };
  }

  if (config.zones?.length) {
    for (const zone of config.zones) {
      const zipMatch = zip && zone.zipCodes?.includes(zip);
      const cityMatch =
        city && zone.cities?.some((c) => c.toLowerCase() === city.toLowerCase());
      if (zipMatch || cityMatch) {
        return {
          status: zone.id === "special" ? "special_zone" : "in_area",
          zone: zone.id,
          message: `Service area confirmed: ${zone.name}.`,
        };
      }
    }
  }

  if (zip && config.zipCodes?.length) {
    if (config.zipCodes.includes(zip)) {
      return { status: "in_area", zone: zip, message: "That address is in our service area." };
    }
    return {
      status: "out_of_area",
      message: "That location is outside our current service area.",
    };
  }

  if (city && config.cities?.length) {
    const match = config.cities.some((c) => c.toLowerCase() === city.toLowerCase());
    if (match) {
      return { status: "in_area", zone: city, message: "That address is in our service area." };
    }
    return {
      status: "out_of_area",
      message: "That location is outside our current service area.",
    };
  }

  // Permissive default when no geo config — tenant must configure to enforce
  if (!config.zipCodes?.length && !config.cities?.length && !config.zones?.length) {
    return { status: "in_area", message: "Address recorded." };
  }

  return { status: "unknown", message: "I could not verify that address yet." };
}
