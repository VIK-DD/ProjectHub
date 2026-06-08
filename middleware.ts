import { withAuth } from "next-auth/middleware";

// Protect every authenticated section of the app. Unauthenticated visitors are
// sent to /login automatically.
export default withAuth({
  pages: { signIn: "/login" },
});

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
