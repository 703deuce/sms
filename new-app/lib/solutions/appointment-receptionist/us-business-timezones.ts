/** US IANA zones for receptionist business hours (scrollable picker labels). */
export const US_BUSINESS_TIMEZONE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "America/New_York", label: "Eastern Time (New York)" },
  { value: "America/Chicago", label: "Central Time (Chicago)" },
  { value: "America/Denver", label: "Mountain Time (Denver)" },
  { value: "America/Phoenix", label: "Arizona (no daylight saving)" },
  { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
  { value: "America/Anchorage", label: "Alaska Time" },
  { value: "Pacific/Honolulu", label: "Hawaii Time" },
];

export const DEFAULT_US_BUSINESS_TIMEZONE = "America/New_York";
