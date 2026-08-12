import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import CashModel from "@/models/Cash";
import GoogleSheetsSyncModel from "@/models/GoogleSheetsSync";

export async function GET() {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");

    const integration = await GoogleSheetsSyncModel.findOne({ user: session.userId });
    if (!integration?.refreshToken) throw new Error("Connect your Google account first.");
    if (!integration.spreadsheetId) throw new Error("Add your Google Sheet details first.");

    const accounts = await BankAccountModel.find({ user: session.userId }).lean();
    const cash = await CashModel.findOne({ user: session.userId }).lean();

    return NextResponse.json({
      accounts: accounts.map((account) => ({
        id: String(account._id),
        bankName: account.bankName,
        accountName: account.accountName,
        last4Digits: account.last4Digits,
        currentBalance: account.currentBalance,
      })),
      cashBalance: cash?.balance ?? 0,
      totalBankBalance: accounts.reduce((sum, account) => sum + account.currentBalance, 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to prepare sync confirmation." },
      { status: 400 }
    );
  }
}
