import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  clearAttempts,
  isRateLimited,
  recordFailedAttempt,
} from "@/lib/rate-limit";
import { authConfig } from "@/lib/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const key = `login:${email}`;

        // Throttle brute-force attempts.
        if (isRateLimited(key)) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          recordFailedAttempt(key);
          return null;
        }

        const valid = await bcrypt.compare(
          String(credentials.password),
          user.passwordHash,
        );
        if (!valid) {
          recordFailedAttempt(key);
          return null;
        }

        clearAttempts(key);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],
});
