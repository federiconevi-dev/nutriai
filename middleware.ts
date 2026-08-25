import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/create",
  "/videos",
  "/assets",
  "/brand-kit",
  "/credits",
  "/settings",
  "/admin",
  "/editor",
  "/projects",
];

const ADMIN_PREFIXES = ["/admin"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.AUTH_SECRET });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/create/:path*",
    "/videos/:path*",
    "/assets/:path*",
    "/brand-kit/:path*",
    "/credits/:path*",
    "/settings/:path*",
    "/admin/:path*",
    "/editor/:path*",
    "/projects/:path*",
  ],
};
