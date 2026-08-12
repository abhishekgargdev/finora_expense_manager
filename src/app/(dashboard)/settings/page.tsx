"use client";

import { Suspense } from "react";
import GoogleSheetsSyncSection from "@/components/integrations/GoogleSheetsSyncSection";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage integrations and keep your external spreadsheets in sync with Finora.
        </p>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading Google Sheets settings...</p>}>
        <GoogleSheetsSyncSection />
      </Suspense>
    </div>
  );
}
