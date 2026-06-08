"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { changePassword } from "@/lib/actions/account";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";

export function PasswordForm() {
  const t = useT();
  const [pending, startTransition] = React.useTransition();
  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("New passwords don't match");
      return;
    }
    startTransition(async () => {
      const res = await changePassword({
        currentPassword: current,
        newPassword: next,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Password changed");
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.password.t")}</CardTitle>
          <CardDescription>{t("settings.password.d")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pw-current">{t("settings.currentPw")}</Label>
            <Input
              id="pw-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pw-new">{t("settings.newPw")}</Label>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">{t("settings.confirmPw")}</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t pt-4">
          <Button
            type="submit"
            disabled={pending || !current || !next || !confirm}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("settings.updatePw")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
