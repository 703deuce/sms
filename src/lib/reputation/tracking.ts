import { randomBytes } from "crypto";
import { appUrl } from "@/lib/app-url";

export function generateTrackingToken(): string {
  return randomBytes(16).toString("base64url");
}

export function buildTrackingUrl(token: string): string {
  return appUrl(`/r/${token}`);
}

export function hashIp(ip: string): string {
  let h = 0;
  for (let i = 0; i < ip.length; i++) h = (h << 5) - h + ip.charCodeAt(i);
  return `ip_${Math.abs(h)}`;
}
