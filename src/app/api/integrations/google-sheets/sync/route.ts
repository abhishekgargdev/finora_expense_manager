import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import GoogleSheetsSyncModel from "@/models/GoogleSheetsSync";
import { syncDataToGoogleSheets, validateBankBalances } from "@/lib/google-sheets";

export async function POST(request: NextRequest) {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");

    const body = await request.json();
    if (!body.bankConfirmed) {
      throw new Error("Please confirm your bank balances before syncing.");
    }

    const integration = await GoogleSheetsSyncModel.findOne({ user: session.userId });
    if (!integration?.refreshToken) throw new Error("Connect your Google account first.");
    if (!integration.spreadsheetId) throw new Error("Add your Google Sheet details first.");

    const accounts = await BankAccountModel.find({ user: session.userId }).lean();
    const confirmedBalances = Array.isArray(body.confirmedBalances) ? body.confirmedBalances : [];

    const mismatches = validateBankBalances(
      accounts.map((account) => ({ id: String(account._id), currentBalance: account.currentBalance })),
      confirmedBalances.map((item: { id: string; balance: number }) => ({
        id: String(item.id),
        balance: Number(item.balance),
      }))
    );

    if (mismatches.length) {
      return NextResponse.json(
        {
          error: "Bank balances do not match the application. Please review your accounts and try again.",
          mismatches,
        },
        { status: 409 }
      );
    }

    integration.lastSyncStatus = "pending";
    await integration.save();

    const result = await syncDataToGoogleSheets(session.userId, integration);

    return NextResponse.json({
      success: true,
      appended: result.appended,
      spreadsheetName: result.spreadsheetName,
      lastSyncedAt: integration.lastSyncedAt,
      nextSyncAt: integration.nextSyncAt,
    });
  } catch (error) {
    await connect();
    const session = await requireAuth().catch(() => null);
    if (session && typeof session.userId === "string") {
      await GoogleSheetsSyncModel.findOneAndUpdate(
        { user: session.userId },
        {
          lastSyncStatus: "failed",
          lastSyncError: error instanceof Error ? error.message : "Sync failed.",
        }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Google Sheets sync failed." },
      { status: 400 }
    );
  }
}
