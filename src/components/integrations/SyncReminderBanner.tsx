"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";

type ReminderData = {
  showReminder: boolean;
  daysUntilSync?: number | null;
  nextSyncAt?: string;
  spreadsheetName?: string;
};

export default function SyncReminderBanner() {
  const [data, setData] = React.useState<ReminderData | null>(null);

  React.useEffect(() => {
    void (async () => {
      const response = await fetch("/api/integrations/google-sheets/reminder");
      if (response.ok) setData(await response.json());
    })();
  }, []);

  if (!data?.showReminder) return null;

  const daysText =
    data.daysUntilSync === 0
      ? "today"
      : data.daysUntilSync === 1
        ? "tomorrow"
        : `in ${data.daysUntilSync} days`;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-amber-500/15 p-2 text-amber-600">
            <CalendarClock className="size-4" />
          </div>
          <div>
            <p className="font-medium">Google Sheets sync due {daysText}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Review your expenses, lending, and bank balances before syncing
              {data.spreadsheetName ? ` to ${data.spreadsheetName}` : ""}.
            </p>
          </div>
        </div>
        <Button variant="outline" className="shrink-0" render={<Link href="/settings" />}>
          <AlertTriangle className="size-4" />
          Review & sync
        </Button>
      </div>
    </div>
  );
}
