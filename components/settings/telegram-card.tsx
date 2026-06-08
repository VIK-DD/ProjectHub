"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, Copy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

import {
  disconnectTelegram,
  generateTelegramCode,
} from "@/lib/actions/telegram";
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

export function TelegramCard({
  connected,
  linkedAt,
  botUsername,
}: {
  connected: boolean;
  linkedAt: Date | null;
  botUsername?: string;
}) {
  const router = useRouter();
  const t = useT();
  const [pending, startTransition] = React.useTransition();
  const [code, setCode] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [disconnectOpen, setDisconnectOpen] = React.useState(false);

  function generate() {
    startTransition(async () => {
      const res = await generateTelegramCode();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setCode(res.code);
    });
  }

  function copy() {
    if (!code) return;
    navigator.clipboard.writeText(`/link ${code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Send className="h-4 w-4" />
          Telegram
        </CardTitle>
        <CardDescription>{t("settings.telegram.d")}</CardDescription>
      </CardHeader>
      <CardContent>
        {connected ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
              <span className="font-medium">{t("settings.connected")}</span>
              {linkedAt ? (
                <span className="text-muted-foreground">
                  · since {format(new Date(linkedAt), "MMM d, yyyy")}
                </span>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDisconnectOpen(true)}
            >
              {t("settings.disconnect")}
            </Button>
          </div>
        ) : code ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open your ProjectHub bot
              {botUsername ? (
                <>
                  {" "}
                  (
                  <a
                    className="text-primary hover:underline"
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{botUsername}
                  </a>
                  )
                </>
              ) : null}{" "}
              and send this message:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg border bg-muted/50 px-3 py-2 font-mono text-sm">
                /link {code}
              </code>
              <Button variant="outline" size="icon" onClick={copy}>
                {copied ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Code expires in 15 minutes. After linking,{" "}
              <button
                onClick={() => router.refresh()}
                className="text-primary hover:underline"
              >
                refresh this page
              </button>
              .
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-2 w-2 rounded-full bg-muted-foreground/40" />
              <span className="text-muted-foreground">
                {t("settings.notConnected")}
              </span>
            </div>
            <Button onClick={generate} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("settings.connect")}
            </Button>
          </div>
        )}
      </CardContent>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Disconnect Telegram?"
        description="The bot will stop working until you link again."
        confirmLabel="Disconnect"
        onConfirm={async () => {
          const res = await disconnectTelegram();
          if (res.ok) {
            toast.success("Telegram disconnected");
            router.refresh();
          }
          return res;
        }}
      />
    </Card>
  );
}
