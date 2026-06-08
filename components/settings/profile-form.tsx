"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { updateProfile } from "@/lib/actions/account";
import { getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export function ProfileForm({
  initial,
}: {
  initial: { name: string; email: string; image: string; username: string };
}) {
  const router = useRouter();
  const { update } = useSession();
  const t = useT();
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState(initial.name);
  const [email, setEmail] = React.useState(initial.email);
  const [image, setImage] = React.useState(initial.image);
  const [username, setUsername] = React.useState(initial.username);

  const dirty =
    name !== initial.name ||
    email !== initial.email ||
    image !== initial.image ||
    username !== initial.username;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateProfile({ name, email, image, username });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      await update({ name: res.name, email: res.email, picture: res.image });
      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <Card>
      <form onSubmit={submit}>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.profile.t")}</CardTitle>
          <CardDescription>{t("settings.profile.d")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              {image ? <AvatarImage src={image} alt="" /> : null}
              <AvatarFallback className="text-base">
                {getInitials(name || email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Label htmlFor="s-image">{t("settings.avatarUrl")}</Label>
              <Input
                id="s-image"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…  (optional)"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="s-name">{t("form.name")}</Label>
              <Input
                id="s-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-email">{t("auth.email")}</Label>
              <Input
                id="s-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s-username">{t("settings.username")}</Label>
            <Input
              id="s-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. victor"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.usernameHint")}
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t pt-4">
          <Button type="submit" disabled={pending || !dirty}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("form.save")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
