import { NextRequest, NextResponse } from "next/server";

import { ensureBankAccount, getUserId, parseIncome, serializeIncome } from "@/lib/income-api";
import connect from "@/lib/db";
import BankTransactionModel from "@/models/BankTransaction";
import IncomeModel from "@/models/Income";

async function getIncome(id: string, userId: string) {
  const income = await IncomeModel.findOne({ _id: id, user: userId });
  if (!income) throw new Error("Income entry not found.");
  return income;
}

async function updateIncome(request: NextRequest, context: RouteContext<"/api/income/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const income = await getIncome(id, userId);
    const input = parseIncome(await request.json(), true);
    const nextBankAccount = input.bankAccount === undefined ? income.bankAccount?.toString() : await ensureBankAccount(userId, input.bankAccount);
    const nextAmount = typeof input.amount === "number" ? input.amount : income.amount;
    const bankChanged = nextBankAccount !== income.bankAccount?.toString() || nextAmount !== income.amount;

    if (bankChanged && income.bankAccount) {
      await BankTransactionModel.recordTransaction({ user: userId, bankAccount: income.bankAccount, type: "Debit", amount: income.amount, description: `Income adjustment: ${income.source}`, date: new Date(), source: "Income", refId: income._id });
    }

    Object.assign(income, input, { bankAccount: nextBankAccount });
    await income.save();

    if (bankChanged && nextBankAccount) {
      await BankTransactionModel.recordTransaction({ user: userId, bankAccount: nextBankAccount, type: "Credit", amount: income.amount, description: `Income: ${income.source}`, date: income.date, source: "Income", refId: income._id });
    }

    return NextResponse.json({ income: serializeIncome(income) });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unable to update income.";
    return NextResponse.json({ error: message }, { status: message === "Income entry not found." ? 404 : 400 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/income/[id]">) {
  return updateIncome(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/income/[id]">) {
  return updateIncome(request, context);
}

export async function DELETE(_: NextRequest, context: RouteContext<"/api/income/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const income = await getIncome(id, userId);

    if (income.bankAccount) {
      await BankTransactionModel.recordTransaction({ user: userId, bankAccount: income.bankAccount, type: "Debit", amount: income.amount, description: `Income removal: ${income.source}`, date: new Date(), source: "Income", refId: income._id });
    }
    await income.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unable to delete income.";
    return NextResponse.json({ error: message }, { status: message === "Income entry not found." ? 404 : 400 });
  }
}
