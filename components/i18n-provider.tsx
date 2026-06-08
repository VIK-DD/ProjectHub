"use client";

import * as React from "react";

import type { Locale } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/dictionaries";

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const I18nContext = React.createContext<{ locale: Locale; t: TFn }>({
  locale: "ro",
  t: (k) => k,
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({
      locale,
      t: (key: string, vars?: Record<string, string | number>) =>
        translate(locale, key, vars),
    }),
    [locale],
  );
  return (
    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
  );
}

export function useT() {
  return React.useContext(I18nContext).t;
}

export function useLocale() {
  return React.useContext(I18nContext).locale;
}
