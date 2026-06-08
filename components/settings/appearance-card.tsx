"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Check, Moon, Sun } from "lucide-react";
import { toast } from "sonner";

import { ACCENTS, accentHsl } from "@/lib/accents";
import { updateAccent } from "@/lib/actions/preferences";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useT } from "@/components/i18n-provider";

const OPTIONS = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
] as const;

export function AppearanceCard({ accent }: { accent: string | null }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const t = useT();
  const [mounted, setMounted] = React.useState(false);
  const [current, setCurrent] = React.useState(accent ?? "violet");
  React.useEffect(() => setMounted(true), []);
  const active = mounted ? theme : "dark";

  function pickAccent(key: string) {
    setCurrent(key);
    // Apply instantly.
    const hsl = accentHsl(key);
    document.documentElement.style.setProperty("--primary", hsl);
    document.documentElement.style.setProperty("--ring", hsl);
    updateAccent(key).then((res) => {
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("settings.appearance.t")}</CardTitle>
        <CardDescription>{t("settings.appearance.d")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t("settings.theme")}</p>
          <div className="grid max-w-md grid-cols-2 gap-3">
            {OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const selected = active === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-lg border p-4 text-left transition-colors",
                    selected ? "border-primary bg-primary/5" : "hover:bg-accent/50",
                  )}
                >
                  <Icon className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {t(`theme.${opt.value}`)}
                  </span>
                  {selected ? (
                    <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t("settings.accent")}</p>
          <div className="flex flex-wrap gap-2.5">
            {ACCENTS.map((a) => (
              <button
                key={a.key}
                type="button"
                aria-label={a.label}
                title={a.label}
                onClick={() => pickAccent(a.key)}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                  current === a.key && "ring-2 ring-foreground/40",
                )}
                style={{ backgroundColor: `hsl(${a.hsl})` }}
              >
                {current === a.key ? (
                  <Check className="h-4 w-4 text-white" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
