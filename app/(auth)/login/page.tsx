"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCsrfToken, signIn } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/components/i18n-provider";

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  // Warm the CSRF cookie so the very first sign-in attempt works (otherwise the
  // first click can fail and only the second succeeds).
  React.useEffect(() => {
    getCsrfToken().catch(() => {});
  }, []);

  async function authenticate(withEmail: string, withPassword: string) {
    setLoading(true);
    const res = await signIn("credentials", {
      email: withEmail,
      password: withPassword,
      redirect: false,
    });
    setLoading(false);

    if (!res || res.error) {
      toast.error("Invalid email or password");
      return;
    }
    toast.success("Welcome back");
    router.push("/dashboard");
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await authenticate(email, password);
  }

  return (
    <Card className="animate-fade-in">
      <CardHeader>
        <CardTitle className="text-xl">{t("auth.signin.title")}</CardTitle>
        <CardDescription>{t("auth.signin.desc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("auth.email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">{t("auth.password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("auth.signin.btn")}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          {t("auth.or")}
          <div className="h-px flex-1 bg-border" />
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={loading}
          onClick={() => authenticate("demo@projecthub.local", "demo1234")}
        >
          {t("auth.demo")}
        </Button>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("auth.noAccount")}{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            {t("auth.createOne")}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
