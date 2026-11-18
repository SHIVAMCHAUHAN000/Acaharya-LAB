// Shared-password access for the browser chat (R&D lab, not production auth).
// The login page sets a cookie "<browserId>.<signature>", where the signature is an
// HMAC-SHA256 of the browser ID keyed with EVE_ACCESS_PASSWORD. Changing the password
// logs everyone out. Keep in sync with apps/web/lib/access.ts.

export const ACCESS_COOKIE = "acharya_access";

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString("base64url");
}

async function sign(password: string, browserId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(`acharya-lab:${browserId}`)));
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(header: string | null, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/** Returns the browser ID when the cookie is valid for the current password, else null. */
export async function verifyAccessCookie(cookieHeader: string | null): Promise<string | null> {
  const password = process.env.EVE_ACCESS_PASSWORD;
  const value = readCookie(cookieHeader, ACCESS_COOKIE);
  if (!password || !value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const browserId = value.slice(0, dot);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(browserId)) return null;
  return safeEqual(value.slice(dot + 1), await sign(password, browserId)) ? browserId : null;
}
