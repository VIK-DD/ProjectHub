import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getReminders, getNotifications } from "@/lib/data";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n-provider";
import { DesktopSidebar } from "@/components/layout/desktop-sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandMenu } from "@/components/layout/command-menu";
import { KeyboardShortcuts } from "@/components/layout/keyboard-shortcuts";
import { QuickCapture } from "@/components/layout/quick-capture";
import { AccentApplier } from "@/components/accent-applier";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const [reminders, notifications, projectOptions, dbUser] = await Promise.all([
    getReminders(user.id),
    getNotifications(user.id),
    prisma.project.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { accentColor: true },
    }),
  ]);

  const locale = getLocale();

  return (
    <I18nProvider locale={locale}>
      <div className="min-h-screen">
        <DesktopSidebar />
        <CommandMenu />
        <KeyboardShortcuts />
        <QuickCapture projects={projectOptions} />
        <AccentApplier accent={dbUser?.accentColor ?? null} />
        <div className="lg:pl-60">
          <Topbar
            user={{ name: user.name, email: user.email, image: user.image }}
            reminders={reminders}
            notifications={notifications.items}
            unread={notifications.unread}
          />
          <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </I18nProvider>
  );
}
