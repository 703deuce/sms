export const REPORTS_PREVIEW_BUSINESS_ID = "preview-reports";

export const reportsPreviewScans = {
  scans: [
    {
      id: "preview-scan-1",
      keyword: "junk removal woodbridge",
      keywordId: "preview-kw-1",
      locationId: null,
      centerLabel: "13327 Kirkdale Ct, Woodbridge, VA 22193",
      gridSize: 7,
      radiusMeters: 8047,
      scannedAt: "2026-07-21T14:42:00.000Z",
      averageRank: 3.9,
      visibilityScore: 100,
    },
    {
      id: "preview-scan-2",
      keyword: "junk hauling woodbridge va",
      keywordId: "preview-kw-2",
      locationId: null,
      centerLabel: "13327 Kirkdale Ct, Woodbridge, VA 22193",
      gridSize: 5,
      radiusMeters: 3219,
      scannedAt: "2026-07-08T14:42:00.000Z",
      averageRank: 5.2,
      visibilityScore: 84,
    },
  ],
};

export const reportsPreviewOptions = {
  keywords: [
    { id: "preview-kw-1", keyword: "junk removal woodbridge", isPrimary: true },
    { id: "preview-kw-2", keyword: "junk hauling woodbridge va", isPrimary: false },
  ],
  campaigns: [
    {
      id: "preview-camp-1",
      name: "Summer review push",
      status: "active",
      channel: "email",
      sent: 42,
      reviewsDetected: 11,
    },
  ],
  mapsCampaigns: [
    {
      id: "preview-maps-camp-1",
      name: "Woodbridge weekly grid",
      status: "active",
      scheduleEnabled: true,
      nextRunAt: "2026-07-28T14:00:00.000Z",
      gridSize: 7,
      radiusMeters: 8047,
    },
  ],
};
