import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import CashTransactionModel from "@/models/CashTransaction";
import { getUserId } from "@/lib/bank-accounts-api";

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const { direction, bankAccountId, amount: rawAmount, date: rawDate, description } = await request.json();

    if (!direction || !["Withdrawal", "Deposit"].includes(direction)) {
      throw new Error("A valid transfer direction (Withdrawal or Deposit) is required.");
    }

    if (!bankAccountId) {
      throw new Error("Bank account is required.");
    }

    const amount = Number(rawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Transfer amount must be greater than zero.");
    }

    const date = rawDate ? new Date(rawDate) : new Date();
    if (Number.isNaN(date.getTime())) {
      throw new Error("A valid date is required.");
    }

    const bankAccount = await BankAccountModel.findOne({ _id: bankAccountId, user: userId });
    if (!bankAccount) {
      throw new Error("Bank account not found.");
    }

    if (direction === "Withdrawal") {
      const debitTx = await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount: bankAccountId,
        type: "Debit",
        amount,
        description: description || `Withdrawal to cash`,
        date,
        source: "Transfer",
      });

      const creditTx = await CashTransactionModel.recordTransaction({
        user: userId,
        type: "Credit",
        amount,
        description: description || `Withdrawal from ${bankAccount.accountName || bankAccount.bankName}`,
        date,
        source: "Withdrawal",
        refId: debitTx._id,
      });

      debitTx.refId = creditTx._id;
      await debitTx.save();

    } else {
      const debitTx = await CashTransactionModel.recordTransaction({
        user: userId,
        type: "Debit",
        amount,
        description: description || `Deposit to ${bankAccount.accountName || bankAccount.bankName}`,
        date,
        source: "Deposit",
      });

      const creditTx = await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount: bankAccountId,
        type: "Credit",
        amount,
        description: description || `Cash deposit`,
        date,
        source: "Transfer",
        refId: debitTx._id,
      });

      debitTx.refId = creditTx._id;
      await debitTx.save();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to complete transfer." },
      { status: 400 }
    );
  }
}
