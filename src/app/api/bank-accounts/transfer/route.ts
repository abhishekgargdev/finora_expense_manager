import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import { getUserId } from "@/lib/bank-accounts-api";

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const { fromAccountId, toAccountId, amount: rawAmount, date: rawDate, description } = await request.json();

    if (!fromAccountId || !toAccountId) {
      throw new Error("Both source and destination accounts are required.");
    }
    if (fromAccountId === toAccountId) {
      throw new Error("Source and destination accounts must be different.");
    }

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Transfer amount must be greater than zero.");
    }

    const date = rawDate ? new Date(rawDate) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new Error("A valid date is required.");
    }

    // Load both accounts to verify ownership and existence
    const [fromAccount, toAccount] = await Promise.all([
      BankAccountModel.findOne({ _id: fromAccountId, user: userId }),
      BankAccountModel.findOne({ _id: toAccountId, user: userId }),
    ]);

    if (!fromAccount) {
      throw new Error("Source bank account not found.");
    }
    if (!toAccount) {
      throw new Error("Destination bank account not found.");
    }

    // Record debit transaction
    const debitTx = await BankTransactionModel.recordTransaction({
      user: userId,
      bankAccount: fromAccountId,
      type: "Debit",
      amount,
      description: description || `Transfer to ${toAccount.accountName || toAccount.bankName}`,
      date,
      source: "Transfer",
    });

    // Record credit transaction
    const creditTx = await BankTransactionModel.recordTransaction({
      user: userId,
      bankAccount: toAccountId,
      type: "Credit",
      amount,
      description: description || `Transfer from ${fromAccount.accountName || fromAccount.bankName}`,
      date,
      source: "Transfer",
      refId: debitTx._id,
    });

    // Link debit to credit transaction
    debitTx.refId = creditTx._id;
    await debitTx.save();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete transfer." },
      { status: 400 }
    );
  }
}
