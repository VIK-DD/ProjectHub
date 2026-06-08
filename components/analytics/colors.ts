// Hex values mirroring the Tailwind "-400" shades used in the status palette,
// so charts match the badges throughout the app.
const HEX: Record<string, Record<string, string>> = {
  task: {
    TODO: "#a1a1aa",
    IN_PROGRESS: "#60a5fa",
    REVIEW: "#a78bfa",
    DONE: "#34d399",
  },
  project: {
    PLANNING: "#a1a1aa",
    ACTIVE: "#60a5fa",
    ON_HOLD: "#fbbf24",
    COMPLETED: "#34d399",
  },
  severity: {
    MINOR: "#a1a1aa",
    MAJOR: "#fbbf24",
    CRITICAL: "#f87171",
  },
};

export function colorFor(
  kind: "task" | "project" | "severity",
  value: string,
): string {
  return HEX[kind]?.[value] ?? "#a1a1aa";
}
