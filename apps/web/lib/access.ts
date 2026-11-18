// Shared-password access for the browser chat (R&D lab, not production auth).
// Cookie value "<browserId>.<signature>", signature = HMAC-SHA256(browserId) keyed with
// EVE_ACCESS_PASSWORD. Keep in sync with agent/lib/access.ts, which the agent uses to
// verify the same cookie on /eve/v1/* requests.

export const ACCESS_COOKIE = "acharya_access";
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const encoder = new TextEncoder();

function toBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  return Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString("base64url");
}

async function sign(password: string, browserId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(`acharya-lab:${browserId}`)));
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Whether the gate is on: always on Vercel; locally only when a password is set. */
export function accessGateEnabled(): boolean {
  return Boolean(process.env.VERCEL) || Boolean(process.env.EVE_ACCESS_PASSWORD);
}

/** Returns the browser ID when the cookie value is valid for the current password, else null. */
export async function verifyAccessValue(value: string | undefined): Promise<string | null> {
  const password = process.env.EVE_ACCESS_PASSWORD;
  if (!password || !value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0) return null;
  const browserId = value.slice(0, dot);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(browserId)) return null;
  return safeEqual(value.slice(dot + 1), await sign(password, browserId)) ? browserId : null;
}

/** Creates a fresh signed cookie value for a new browser. */
export async function createAccessValue(password: string): Promise<string> {
  const browserId = toBase64Url(crypto.getRandomValues(new Uint8Array(18)));
  return `${browserId}.${await sign(password, browserId)}`;
}
