"use client";

import { useEffect } from "react";

import { accentHsl } from "@/lib/accents";

// Overrides --primary / --ring at runtime so the chosen accent applies in both
// light and dark mode (inline style on <html> beats the stylesheet).
export function AccentApplier({ accent }: { accent: string | null }) {
  useEffect(() => {
    const hsl = accentHsl(accent);
    const root = document.documentElement;
    root.style.setProperty("--primary", hsl);
    root.style.setProperty("--ring", hsl);
  }, [accent]);

  return null;
}
