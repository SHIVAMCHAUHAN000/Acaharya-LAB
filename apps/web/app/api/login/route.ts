import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_COOKIE_MAX_AGE, createAccessValue, safeEqual } from "@/lib/access";

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  // Only same-site relative paths, never "//host" or absolute URLs.
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export async function POST(request: Request) {
  const form = await request.formData();
  const next = safeNext(form.get("returnTo"));
  const password = process.env.EVE_ACCESS_PASSWORD;
  const given = form.get("password");

  if (!password || typeof given !== "string" || !safeEqual(given, password)) {
    // Small delay to slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    const url = new URL("/login", request.url);
    url.searchParams.set("error", password ? "1" : "config");
    url.searchParams.set("next", next);
    return NextResponse.redirect(url, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(ACCESS_COOKIE, await createAccessValue(password), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  });
  return response;
}
