import { NextRequest, NextResponse } from "next/server";

import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import LendingModel from "@/models/Lending";
import { getUserId, parseLending, serializeLending } from "@/lib/lending-api";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function GET(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const type = text(request.nextUrl.searchParams.get("type"));
    const query: Record<string, unknown> = { user: userId };
    if (type) query.type = type;
    const [lending, bankAccounts] = await Promise.all([
      LendingModel.find(query).sort({ date: -1, createdAt: -1 }).lean(),
      BankAccountModel.find({ user: userId }).sort({ bankName: 1 }).select("bankName accountName last4Digits").lean(),
    ]);
    return NextResponse.json({
      lending: lending.map(serializeLending),
      bankAccounts: bankAccounts.map((account) => ({
        id: account._id.toString(),
        name: account.accountName || account.bankName,
        last4Digits: account.last4Digits,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load lending records." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const lending = await LendingModel.create({
      ...parseLending(await request.json()),
      user: userId,
      amountReturned: 0,
    });
    return NextResponse.json({ lending: serializeLending(lending) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create lending record." },
      { status: 400 }
    );
  }
}
