import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import GoogleSheetsSyncModel from "@/models/GoogleSheetsSync";
import { parseSpreadsheetId } from "@/lib/sheet-columns";
import { calculateNextSyncAt } from "@/lib/sync-schedule";
import { getDaysUntilSync, shouldShowSyncReminder } from "@/lib/sync-schedule";

function serializeConfig(doc: Awaited<ReturnType<typeof GoogleSheetsSyncModel.findOne>>) {
  if (!doc) {
    return {
      connected: false,
      enabled: false,
      scheduleType: "monthly" as const,
      intervalDays: 30,
      dayOfMonth: 1,
      monthOfYear: 1,
      dayOfYear: 1,
      oauthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    };
  }

  return {
    connected: Boolean(doc.refreshToken),
    enabled: doc.enabled,
    spreadsheetId: doc.spreadsheetId,
    spreadsheetUrl: doc.spreadsheetUrl,
    spreadsheetName: doc.spreadsheetName,
    connectedEmail: doc.connectedEmail,
    scheduleType: doc.scheduleType,
    intervalDays: doc.intervalDays ?? 30,
    dayOfMonth: doc.dayOfMonth ?? 1,
    monthOfYear: doc.monthOfYear ?? 1,
    dayOfYear: doc.dayOfYear ?? 1,
    lastSyncedAt: doc.lastSyncedAt,
    nextSyncAt: doc.nextSyncAt,
    daysUntilSync: getDaysUntilSync(doc.nextSyncAt),
    showReminder: shouldShowSyncReminder(doc.nextSyncAt),
    lastSyncStatus: doc.lastSyncStatus,
    lastSyncError: doc.lastSyncError,
    oauthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  };
}

export async function GET() {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");

    const config = await GoogleSheetsSyncModel.findOne({ user: session.userId });
    return NextResponse.json(serializeConfig(config));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load Google Sheets settings." },
      { status: 400 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");

    const body = await request.json();
    let config = await GoogleSheetsSyncModel.findOne({ user: session.userId });
    if (!config) {
      config = await GoogleSheetsSyncModel.create({ user: session.userId });
    }

    if (typeof body.enabled === "boolean") config.enabled = body.enabled;

    if (body.spreadsheetUrl || body.spreadsheetId) {
      const spreadsheetId = parseSpreadsheetId(body.spreadsheetUrl ?? body.spreadsheetId ?? "");
      if (!spreadsheetId) throw new Error("Enter a valid Google Sheets URL or spreadsheet ID.");
      config.spreadsheetId = spreadsheetId;
      config.spreadsheetUrl = body.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
    }

    if (body.scheduleType) {
      if (!["interval", "monthly", "yearly"].includes(body.scheduleType)) {
        throw new Error("Invalid schedule type.");
      }
      config.scheduleType = body.scheduleType;
    }

    if (body.intervalDays !== undefined) config.intervalDays = Number(body.intervalDays);
    if (body.dayOfMonth !== undefined) config.dayOfMonth = Number(body.dayOfMonth);
    if (body.monthOfYear !== undefined) config.monthOfYear = Number(body.monthOfYear);
    if (body.dayOfYear !== undefined) config.dayOfYear = Number(body.dayOfYear);

    if (!config.nextSyncAt) {
      config.nextSyncAt = calculateNextSyncAt({
        scheduleType: config.scheduleType,
        intervalDays: config.intervalDays,
        dayOfMonth: config.dayOfMonth,
        monthOfYear: config.monthOfYear,
        dayOfYear: config.dayOfYear,
      });
    }

    await config.save();
    return NextResponse.json(serializeConfig(config));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save Google Sheets settings." },
      { status: 400 }
    );
  }
}
