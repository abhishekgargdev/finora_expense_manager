import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import { getUserId, parseAccount, serializeAccount } from "@/lib/bank-accounts-api";
export async function GET() {
  try {
    await connect();
    const accounts = await BankAccountModel.find({ user: await getUserId() })
      .sort({ updatedAt: -1 })
      .lean();
    return NextResponse.json({ accounts: accounts.map(serializeAccount) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load bank accounts." },
      { status: 500 }
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    await connect();
    const input = parseAccount(await request.json());
    const account = await BankAccountModel.create({
      ...input,
      user: await getUserId(),
      currentBalance: input.openingBalance as number,
    });
    return NextResponse.json({ account: serializeAccount(account) }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create bank account." },
      { status: 400 }
    );
  }
}
