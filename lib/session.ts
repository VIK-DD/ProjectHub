import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getSession() {
  return auth();
}

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

/**
 * Use inside server components / actions to guarantee an authenticated user.
 * Redirects to /login if there is no session.
 */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}
