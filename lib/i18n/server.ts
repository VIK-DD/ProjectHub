import { cookies } from "next/headers";

import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES, type Locale } from "./config";
import { translate } from "./dictionaries";

export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return (LOCALES as readonly string[]).includes(value ?? "")
    ? (value as Locale)
    : DEFAULT_LOCALE;
}

// Translator for server components.
export function getT() {
  const locale = getLocale();
  return (key: string, vars?: Record<string, string | number>) =>
    translate(locale, key, vars);
}
