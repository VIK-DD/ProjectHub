// Accent color presets. Stored as a key on User.accentColor and applied by
// overriding the --primary / --ring CSS variables (HSL triples).
export const ACCENTS = [
  { key: "violet", label: "Violet", hsl: "250 84% 60%" },
  { key: "blue", label: "Blue", hsl: "217 91% 60%" },
  { key: "emerald", label: "Emerald", hsl: "152 70% 42%" },
  { key: "rose", label: "Rose", hsl: "347 77% 55%" },
  { key: "orange", label: "Orange", hsl: "24 90% 55%" },
  { key: "cyan", label: "Cyan", hsl: "190 85% 42%" },
] as const;

export type AccentKey = (typeof ACCENTS)[number]["key"];
export const ACCENT_KEYS = ACCENTS.map((a) => a.key);
export const DEFAULT_ACCENT: AccentKey = "violet";

export function accentHsl(key?: string | null): string {
  return (ACCENTS.find((a) => a.key === key) ?? ACCENTS[0]).hsl;
}
