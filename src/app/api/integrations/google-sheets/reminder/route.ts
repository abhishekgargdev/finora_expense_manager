import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import GoogleSheetsSyncModel from "@/models/GoogleSheetsSync";
import { getDaysUntilSync, shouldShowSyncReminder } from "@/lib/sync-schedule";

export async function GET() {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");

    const config = await GoogleSheetsSyncModel.findOne({ user: session.userId });
    if (!config?.enabled || !config.nextSyncAt) {
      return NextResponse.json({ showReminder: false });
    }

    const daysUntilSync = getDaysUntilSync(config.nextSyncAt);
    return NextResponse.json({
      showReminder: shouldShowSyncReminder(config.nextSyncAt),
      daysUntilSync,
      nextSyncAt: config.nextSyncAt,
      lastSyncedAt: config.lastSyncedAt,
      scheduleType: config.scheduleType,
      spreadsheetName: config.spreadsheetName,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load sync reminder." },
      { status: 400 }
    );
  }
}
