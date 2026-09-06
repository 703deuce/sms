import { createVerify } from "crypto";

function normalizePem(cert: string): string {
  const trimmed = cert.trim();
  if (trimmed.includes("BEGIN CERTIFICATE")) return trimmed;
  const body = trimmed.replace(/\s+/g, "");
  const lines = body.match(/.{1,64}/g) || [body];
  return `-----BEGIN CERTIFICATE-----\n${lines.join("\n")}\n-----END CERTIFICATE-----`;
}

function stripPem(cert: string): string {
  return cert.replace(/-----BEGIN CERTIFICATE-----/g, "").replace(/-----END CERTIFICATE-----/g, "").replace(/\s+/g, "");
}

export type SamlVerifyResult = {
  ok: boolean;
  xml: string;
  error?: string;
};

/** Validate SAML response timestamps, certificate pin, and RSA-SHA256 signature. */
export function verifySamlResponse(samlResponseBase64: string, idpCertificatePem: string): SamlVerifyResult {
  const xml = Buffer.from(samlResponseBase64, "base64").toString("utf8");
  if (!idpCertificatePem?.trim()) {
    return { ok: false, xml, error: "IdP certificate is required for SAML SSO" };
  }

  const notOnOrAfter = xml.match(/NotOnOrAfter="([^"]+)"/i)?.[1];
  if (notOnOrAfter && Date.parse(notOnOrAfter) < Date.now() - 60_000) {
    return { ok: false, xml, error: "SAML assertion expired" };
  }

  const notBefore = xml.match(/NotBefore="([^"]+)"/i)?.[1];
  if (notBefore && Date.parse(notBefore) > Date.now() + 60_000) {
    return { ok: false, xml, error: "SAML assertion not yet valid" };
  }

  const embeddedCert = xml
    .match(/<(?:[\w]+:)?X509Certificate>([\s\S]*?)<\/(?:[\w]+:)?X509Certificate>/i)?.[1]
    ?.replace(/\s+/g, "");
  const configuredCert = stripPem(idpCertificatePem);
  if (embeddedCert && configuredCert && embeddedCert !== configuredCert) {
    return { ok: false, xml, error: "SAML signing certificate does not match configured IdP certificate" };
  }

  const signatureValue = xml
    .match(/<(?:[\w]+:)?SignatureValue[^>]*>([\s\S]*?)<\/(?:[\w]+:)?SignatureValue>/i)?.[1]
    ?.replace(/\s+/g, "");
  const signedInfo = xml.match(/<(?:[\w]+:)?SignedInfo[\s\S]*?<\/(?:[\w]+:)?SignedInfo>/i)?.[0];
  if (!signatureValue || !signedInfo) {
    return { ok: false, xml, error: "SAML signature missing" };
  }

  const pem = normalizePem(idpCertificatePem);
  const attempts = [signedInfo, signedInfo.replace(/ ds:/g, " ").replace(/\s+xmlns:ds="[^"]*"/g, "")];
  const verified = attempts.some((payload) => {
    const verifier = createVerify("RSA-SHA256");
    verifier.update(payload);
    return verifier.verify(pem, signatureValue, "base64");
  });

  if (!verified) {
    return { ok: false, xml, error: "SAML signature verification failed" };
  }

  return { ok: true, xml };
}

export function extractSamlEmail(xml: string): string | null {
  const nameId =
    xml.match(/<(?:[\w]+:)?NameID[^>]*>([^<]+)<\/(?:[\w]+:)?NameID>/i)?.[1] ||
    xml.match(/<NameID[^>]*>([^<]+)<\/NameID>/i)?.[1];
  if (nameId?.includes("@")) return nameId.trim();
  const emailAttr =
    xml.match(/Name="(?:email|Email|mail|user\.principalname)"[^>]*>[\s\S]*?<(?:[\w]+:)?AttributeValue[^>]*>([^<]+)</i)?.[1] ||
    xml.match(/Name="(?:email|Email|mail)"[^>]*>[\s\S]*?<AttributeValue[^>]*>([^<]+)</i)?.[1];
  return emailAttr?.trim() || null;
}
