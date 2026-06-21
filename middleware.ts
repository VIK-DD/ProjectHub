import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Protect every authenticated section of the app. Unauthenticated visitors are
// sent to /login automatically (via the `authorized` callback in auth.config).
// Uses the edge-safe config only — no Prisma in the middleware bundle.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: [
    "/today/:path*",
    "/dashboard/:path*",
    "/projects/:path*",
    "/tasks/:path*",
    "/calendar/:path*",
    "/bugs/:path*",
    "/notes/:path*",
    "/analytics/:path*",
    "/settings/:path*",
    "/trash/:path*",
  ],
};
