import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import CashModel from "@/models/Cash";
import CashTransactionModel from "@/models/CashTransaction";
import { getUserId } from "@/lib/bank-accounts-api";

export async function GET() {
  try {
    await connect();
    const userId = await getUserId();

    let cash = await CashModel.findOne({ user: userId }).lean();
    if (!cash) {
      cash = await CashModel.create({ user: userId, balance: 0 });
    }

    const transactions = await CashTransactionModel.find({ user: userId })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({
      balance: cash.balance,
      transactions: transactions.map((tx) => ({
        id: tx._id.toString(),
        type: tx.type,
        amount: tx.amount,
        description: tx.description,
        date: tx.date.toISOString(),
        source: tx.source,
        refId: tx.refId?.toString() ?? null,
        balanceAfter: tx.balanceAfter,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load cash wallet details." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const body = await request.json();

    const type = body.type === "Credit" || body.type === "Debit" ? body.type : "";
    const amount = Number(body.amount);
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const date = new Date(String(body.date));

    if (!type) throw new Error("Choose a transaction type.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
    if (!description) throw new Error("Description is required.");
    if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");

    const transaction = await CashTransactionModel.recordTransaction({
      user: userId,
      type,
      amount,
      description,
      date,
      source: "Manual",
    });

    return NextResponse.json(
      {
        transaction: {
          id: transaction._id.toString(),
          type: transaction.type,
          amount: transaction.amount,
          description: transaction.description,
          date: transaction.date.toISOString(),
          source: transaction.source,
          balanceAfter: transaction.balanceAfter,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add cash transaction." },
      { status: 400 }
    );
  }
}
