import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, accessGateEnabled, verifyAccessValue } from "@/lib/access";

const PUBLIC_PATHS = new Set(["/login", "/api/login", "/eve/v1/health"]);

// The nightly gardener's test chats call the agent API with a server secret instead of the password cookie.
// The agent's own auth (agent/channels/eve.ts) checks the same token again.
function isGardenerCall(request: NextRequest): boolean {
  const expected = process.env.GARDENER_TOKEN;
  const got = request.headers.get("x-gardener-token");
  if (!expected || !got || got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export async function proxy(request: NextRequest) {
  const routerHost = process.env.VERCEL_URL;
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (process.env.__VERCEL_DEV_RUNNING === "1" && routerHost && forwardedHost !== routerHost) {
    const target = request.nextUrl.clone();
    target.protocol = "http:";
    target.host = routerHost;
    return NextResponse.redirect(target);
  }

  // Shared-password gate (EVE_ACCESS_PASSWORD). The agent re-checks the same cookie.
  const { pathname, search } = request.nextUrl;
  if (!accessGateEnabled() || PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (pathname.startsWith("/eve/") && isGardenerCall(request)) return NextResponse.next();
  if (await verifyAccessValue(request.cookies.get(ACCESS_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/eve/") || pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Password required. Open the site and sign in." }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Skip Next.js build assets and the app icons.
  matcher: ["/((?!_next/static|_next/image|icon.svg|apple-icon|favicon.ico).*)"],
};
