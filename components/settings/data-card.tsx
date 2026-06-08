"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useT } from "@/components/i18n-provider";

export function DataCard() {
  const router = useRouter();
  const t = useT();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setConfirmOpen(true);
    }
    e.target.value = "";
  }

  async function runImport() {
    if (!file) return;
    const text = await file.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      toast.error("That file isn't valid JSON");
      return;
    }
    const res = await fetch("/api/backup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(json),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast.error(err.error ?? "Import failed");
      return { ok: false as const, error: err.error ?? "Import failed" };
    }
    toast.success("Backup restored");
    setFile(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.data.t")}</CardTitle>
        <CardDescription>{t("settings.data.d")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row">
        <Button asChild variant="outline">
          <a href="/api/backup" download>
            <Download className="h-4 w-4" />
            {t("settings.download")}
          </a>
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          {t("settings.import")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onPick}
        />
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Restore from backup?"
        description="This replaces ALL your current projects, tasks, bugs, notes and milestones with the contents of the file. This cannot be undone."
        confirmLabel="Replace my data"
        onConfirm={runImport}
      />
    </Card>
  );
}
