/**
 * Canonical public origin for redirects, Stripe return URLs, and emails.
 *
 * Prefer NEXT_PUBLIC_APP_URL when the deploy domain changed (e.g. away from an
 * old Vercel project name) so stale NEXTAUTH_URL does not send users elsewhere.
 */
export function getAppUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const value of candidates) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed.replace(/\/$/, "");
  }

  return "http://localhost:3000";
}

/** Prefer the live request Host over env (fixes stale NEXTAUTH_URL after renames). */
export function getRequestAppUrl(request: {
  headers: Headers;
  nextUrl: URL;
}): string {
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host")?.trim();
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    request.nextUrl.protocol.replace(":", "") ||
    "https";

  if (host) return `${proto}://${host}`.replace(/\/$/, "");
  return request.nextUrl.origin || getAppUrl();
}
