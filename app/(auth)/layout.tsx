import { Logo } from "@/components/logo";
import { getLocale, getT } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n-provider";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const t = await getT();
  return (
    <I18nProvider locale={locale}>
      <div className="dark flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>
          {children}
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          {t("auth.footer")}
        </p>
      </div>
    </I18nProvider>
  );
}
