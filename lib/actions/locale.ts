"use server";

import { cookies } from "next/headers";

import { LOCALES, LOCALE_COOKIE } from "@/lib/i18n/config";

export async function setLocale(locale: string) {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  cookies().set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
