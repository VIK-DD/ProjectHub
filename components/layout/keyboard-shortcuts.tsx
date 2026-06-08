"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

// Single-key navigation + actions, Linear-style.
//   g then d/y/p/t/c/b/n/a  → navigate
//   c                       → quick-add a task
//   /                       → open the ⌘K palette
const GO_MAP: Record<string, string> = {
  y: "/today",
  d: "/dashboard",
  p: "/projects",
  t: "/tasks",
  c: "/calendar",
  b: "/bugs",
  n: "/notes",
  a: "/analytics",
};

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

export function KeyboardShortcuts() {
  const router = useRouter();
  const gPending = React.useRef(false);
  const gAt = React.useRef(0);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;

      const key = e.key.toLowerCase();
      const now = Date.now();

      // Second key of a "g" chord.
      if (gPending.current && now - gAt.current < 1200) {
        gPending.current = false;
        const href = GO_MAP[key];
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }

      if (key === "g") {
        gPending.current = true;
        gAt.current = now;
        return;
      }
      gPending.current = false;

      if (key === "c") {
        e.preventDefault();
        window.dispatchEvent(new Event("projecthub:quickadd"));
      } else if (key === "/") {
        e.preventDefault();
        window.dispatchEvent(new Event("projecthub:command"));
      }
    }

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [router]);

  return null;
}
