import type { NextAuthConfig } from "next-auth";

// Edge-safe auth config shared with the middleware. It must NOT import Prisma or
// bcrypt — those are Node-only and would break the Edge middleware bundle. The
// Credentials provider (which needs the database) lives in lib/auth.ts instead.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  providers: [],
  callbacks: {
    // Gates the matched routes in middleware.ts — any signed-in user is allowed,
    // unauthenticated visitors are redirected to /login.
    authorized({ auth }) {
      return Boolean(auth?.user);
    },
    jwt({ token, user, trigger, session }) {
      if (user) token.id = user.id as string;
      // Allow the client to push fresh profile data into the JWT after an
      // account update (called via useSession().update(...)).
      if (trigger === "update" && session) {
        const s = session as Record<string, unknown>;
        if (typeof s.name === "string") token.name = s.name;
        if (typeof s.email === "string") token.email = s.email;
        if ("picture" in s) token.picture = (s.picture as string | null) ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        if (token.name) session.user.name = token.name;
        if (token.email) session.user.email = token.email;
        session.user.image = (token.picture as string | null) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
