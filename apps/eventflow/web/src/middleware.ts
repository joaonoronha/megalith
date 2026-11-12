import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./lib/session";

// Public path prefixes that do NOT require login
const PUBLIC_PREFIXES = [
  "/login",
  "/proposta",           // Public client quote review & digital approval
  "/orcamento",          // Alternative public proposal alias
  "/api/webhooks",       // Webhook endpoints (e.g. Calendly)
  "/api/auth/callback",  // Auth callbacks
  "/api/uploads",        // Uploaded media files
  "/uploads",            // Static upload folder fallback
  "/_next",              // Static assets & chunks
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Rewrite /orcamento/:token to /proposta/:token for Portuguese URL flexibility
  if (pathname.startsWith("/orcamento/")) {
    const token = pathname.replace("/orcamento/", "");
    return NextResponse.rewrite(new URL(`/proposta/${token}`, request.url));
  }

  // 2. Allow public routes
  const isPublic = PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isPublic) {
    return NextResponse.next();
  }

  // 3. Verify session cookie signature & expiration
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  const validSession = await verifySessionToken(sessionToken);
  if (!validSession) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }

  // Valid session verified
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
