"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateNotificationPrefs } from "@/lib/actions/preferences";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useT } from "@/components/i18n-provider";

export type NotificationPrefs = {
  notifyMorning: boolean;
  morningHour: number;
  notifyEvening: boolean;
  eveningHour: number;
  notifyAssigned: boolean;
  notifyComments: boolean;
  notifyMentions: boolean;
  notifyReminders: boolean;
};

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmtHour = (h: number) => `${String(h).padStart(2, "0")}:00`;

function Row({
  title,
  description,
  checked,
  onChange,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {children}
        <Checkbox
          checked={checked}
          onCheckedChange={(c) => onChange(Boolean(c))}
        />
      </div>
    </div>
  );
}

export function NotificationsCard({ initial }: { initial: NotificationPrefs }) {
  const router = useRouter();
  const t = useT();
  const [p, setP] = React.useState<NotificationPrefs>(initial);
  const [pending, startTransition] = React.useTransition();
  const set = <K extends keyof NotificationPrefs>(
    key: K,
    value: NotificationPrefs[K],
  ) => setP((prev) => ({ ...prev, [key]: value }));

  function HourSelect({
    value,
    onChange,
    disabled,
  }: {
    value: number;
    onChange: (h: number) => void;
    disabled?: boolean;
  }) {
    return (
      <Select
        value={String(value)}
        onValueChange={(v) => onChange(Number(v))}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 w-24">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {HOURS.map((h) => (
            <SelectItem key={h} value={String(h)}>
              {fmtHour(h)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  function save() {
    startTransition(async () => {
      const res = await updateNotificationPrefs(p);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Notification preferences saved");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.notif.t")}</CardTitle>
        <CardDescription>{t("settings.notif.d")}</CardDescription>
      </CardHeader>
      <CardContent className="divide-y py-0">
        <Row
          title={t("settings.morning.t")}
          description={t("settings.morning.d")}
          checked={p.notifyMorning}
          onChange={(v) => set("notifyMorning", v)}
        >
          <HourSelect
            value={p.morningHour}
            onChange={(h) => set("morningHour", h)}
            disabled={!p.notifyMorning}
          />
        </Row>
        <Row
          title={t("settings.evening.t")}
          description={t("settings.evening.d")}
          checked={p.notifyEvening}
          onChange={(v) => set("notifyEvening", v)}
        >
          <HourSelect
            value={p.eveningHour}
            onChange={(h) => set("eveningHour", h)}
            disabled={!p.notifyEvening}
          />
        </Row>
        <Row
          title={t("settings.assigned.t")}
          description={t("settings.assigned.d")}
          checked={p.notifyAssigned}
          onChange={(v) => set("notifyAssigned", v)}
        />
        <Row
          title={t("settings.comments.t")}
          description={t("settings.comments.d")}
          checked={p.notifyComments}
          onChange={(v) => set("notifyComments", v)}
        />
        <Row
          title={t("settings.mentions.t")}
          description={t("settings.mentions.d")}
          checked={p.notifyMentions}
          onChange={(v) => set("notifyMentions", v)}
        />
        <Row
          title={t("settings.reminders.t")}
          description={t("settings.reminders.d")}
          checked={p.notifyReminders}
          onChange={(v) => set("notifyReminders", v)}
        />
      </CardContent>
      <CardFooter className="justify-end border-t pt-4">
        <Button onClick={save} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t("settings.savePrefs")}
        </Button>
      </CardFooter>
    </Card>
  );
}
