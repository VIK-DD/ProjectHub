import type { Metadata } from "next";
import { format } from "date-fns";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getT } from "@/lib/i18n/server";
import { PageHeader } from "@/components/page-header";
import { ProfileForm } from "@/components/settings/profile-form";
import { PasswordForm } from "@/components/settings/password-form";
import { AppearanceCard } from "@/components/settings/appearance-card";
import { DataCard } from "@/components/settings/data-card";
import { TelegramCard } from "@/components/settings/telegram-card";
import { NotificationsCard } from "@/components/settings/notifications-card";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const sessionUser = await requireUser();
  const t = await getT();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      username: true,
      email: true,
      image: true,
      createdAt: true,
      telegramChatId: true,
      telegramLinkedAt: true,
      notifyMorning: true,
      morningHour: true,
      notifyEvening: true,
      eveningHour: true,
      notifyAssigned: true,
      notifyComments: true,
      notifyMentions: true,
      notifyReminders: true,
      accentColor: true,
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={t("page.settings.title")}
        description={
          user?.createdAt
            ? t("page.settings.memberSince", {
                date: format(user.createdAt, "MMMM yyyy"),
              })
            : t("page.settings.manage")
        }
      />

      <ProfileForm
        initial={{
          name: user?.name ?? "",
          email: user?.email ?? "",
          image: user?.image ?? "",
          username: user?.username ?? "",
        }}
      />
      <PasswordForm />
      <TelegramCard
        connected={Boolean(user?.telegramChatId)}
        linkedAt={user?.telegramLinkedAt ?? null}
        botUsername={process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME}
      />
      {user ? (
        <NotificationsCard
          initial={{
            notifyMorning: user.notifyMorning,
            morningHour: user.morningHour,
            notifyEvening: user.notifyEvening,
            eveningHour: user.eveningHour,
            notifyAssigned: user.notifyAssigned,
            notifyComments: user.notifyComments,
            notifyMentions: user.notifyMentions,
            notifyReminders: user.notifyReminders,
          }}
        />
      ) : null}
      <AppearanceCard accent={user?.accentColor ?? null} />
      <DataCard />
    </div>
  );
}
