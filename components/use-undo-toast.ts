"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * Centralized "X deleted — Undo" toast. Keeps the undo affordance identical
 * everywhere: success toast + an Undo action that runs the restore and
 * refreshes the router. Callers keep their own post-delete side effects
 * (router.refresh / router.push / clearSelection) — this only owns the toast.
 *
 *   const undoToast = useUndoToast();
 *   if (res.ok) {
 *     undoToast("Note deleted", () => restoreNote(note.id));
 *     router.refresh();
 *   }
 */
export function useUndoToast() {
  const router = useRouter();
  return (message: string, restore: () => Promise<unknown>) =>
    toast.success(message, {
      action: {
        label: "Undo",
        onClick: () => Promise.resolve(restore()).then(() => router.refresh()),
      },
    });
}
