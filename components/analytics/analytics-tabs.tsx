"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Client tab shell for /analytics. Receives server-rendered panels as props so
 * the heavy data fetching stays on the server — only the tab switching is
 * client-side. Nesting Weekly Review here keeps it out of the sidebar.
 */
export function AnalyticsTabs({
  defaultTab,
  overviewLabel,
  reviewLabel,
  overview,
  review,
}: {
  defaultTab?: string;
  overviewLabel: string;
  reviewLabel: string;
  overview: ReactNode;
  review: ReactNode;
}) {
  return (
    <Tabs
      defaultValue={defaultTab === "review" ? "review" : "overview"}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="overview">{overviewLabel}</TabsTrigger>
        <TabsTrigger value="review">{reviewLabel}</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="space-y-6">
        {overview}
      </TabsContent>
      <TabsContent value="review" className="space-y-6">
        {review}
      </TabsContent>
    </Tabs>
  );
}
