import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import GoogleSheetsSyncModel from "@/models/GoogleSheetsSync";
import { exchangeCodeForTokens } from "@/lib/google-sheets";
import { calculateNextSyncAt } from "@/lib/sync-schedule";

export async function GET(request: NextRequest) {
  const appUrl = request.nextUrl.origin;
  const settingsUrl = `${appUrl}/settings?google=connected`;

  try {
    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
      return NextResponse.redirect(`${appUrl}/settings?google=error&message=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${appUrl}/settings?google=error&message=Missing%20authorization%20code`);
    }

    const payload = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as { userId?: string };
    if (!payload.userId) {
      return NextResponse.redirect(`${appUrl}/settings?google=error&message=Invalid%20state`);
    }

    await connect();
    const tokens = await exchangeCodeForTokens(code);

    let config = await GoogleSheetsSyncModel.findOne({ user: payload.userId });
    if (!config) {
      config = await GoogleSheetsSyncModel.create({ user: payload.userId });
    }

    config.accessToken = tokens.accessToken;
    config.refreshToken = tokens.refreshToken || config.refreshToken;
    config.tokenExpiry = tokens.tokenExpiry;
    config.connectedEmail = tokens.connectedEmail;
    config.enabled = true;

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
    return NextResponse.redirect(settingsUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google authorization failed.";
    return NextResponse.redirect(`${appUrl}/settings?google=error&message=${encodeURIComponent(message)}`);
  }
}
