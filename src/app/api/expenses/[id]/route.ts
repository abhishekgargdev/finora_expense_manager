import { NextRequest, NextResponse } from "next/server";

import { ensureBankAccount, ensureCreditCard, getUserId, parseExpense, serializeExpense } from "@/lib/expenses-api";
import connect from "@/lib/db";
import BankTransactionModel from "@/models/BankTransaction";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";
import ExpenseModel from "@/models/Expense";

async function getExpense(id: string, userId: string) {
  const expense = await ExpenseModel.findOne({ _id: id, user: userId });
  if (!expense) throw new Error("Expense entry not found.");
  return expense;
}

async function updateExpense(request: NextRequest, context: RouteContext<"/api/expenses/[id]">) {
  try {
    await connect(); const userId = await getUserId(); const { id } = await context.params; const expense = await getExpense(id, userId);
    const input = parseExpense(await request.json(), true);
    const paymentMode = String(input.paymentMode ?? expense.paymentMode);
    const bankAccount = input.bankAccount === undefined ? expense.bankAccount?.toString() : await ensureBankAccount(userId, input.bankAccount);
    const creditCard = input.creditCard === undefined ? expense.creditCard?.toString() : await ensureCreditCard(userId, input.creditCard);
    if (paymentMode === "Credit Card" && !creditCard) throw new Error("Choose a credit card.");
    if (["UPI", "Debit Card", "Bank Transfer"].includes(paymentMode) && !bankAccount) throw new Error("Choose a bank account.");
    const amount = typeof input.amount === "number" ? input.amount : expense.amount;
    const bankChanged = bankAccount !== expense.bankAccount?.toString() || amount !== expense.amount;

    if (bankChanged && expense.bankAccount) await BankTransactionModel.recordTransaction({ user: userId, bankAccount: expense.bankAccount, type: "Credit", amount: expense.amount, description: `Expense adjustment: ${expense.source || expense.category}`, source: "Expense", refId: expense._id });
    await CreditCardTransactionModel.deleteMany({ user: userId, expenseRef: expense._id });
    Object.assign(expense, input, { paymentMode, bankAccount, creditCard }); await expense.save();
    if (bankChanged && bankAccount) await BankTransactionModel.recordTransaction({ user: userId, bankAccount, type: "Debit", amount: expense.amount, description: `Expense: ${expense.source || expense.category}`, date: expense.date, source: "Expense", refId: expense._id });
    if (creditCard) await CreditCardTransactionModel.create({ user: userId, creditCard, amount: expense.amount, description: expense.source || expense.category, date: expense.date, expenseRef: expense._id });
    return NextResponse.json({ expense: serializeExpense(expense) });
  } catch (error) { if (error instanceof Response) return error; const message = error instanceof Error ? error.message : "Unable to update expense."; return NextResponse.json({ error: message }, { status: message === "Expense entry not found." ? 404 : 400 }); }
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/expenses/[id]">) { return updateExpense(request, context); }
export async function PATCH(request: NextRequest, context: RouteContext<"/api/expenses/[id]">) { return updateExpense(request, context); }

export async function DELETE(_: NextRequest, context: RouteContext<"/api/expenses/[id]">) {
  try {
    await connect(); const userId = await getUserId(); const { id } = await context.params; const expense = await getExpense(id, userId);
    if (expense.bankAccount) await BankTransactionModel.recordTransaction({ user: userId, bankAccount: expense.bankAccount, type: "Credit", amount: expense.amount, description: `Expense removal: ${expense.source || expense.category}`, source: "Expense", refId: expense._id });
    await CreditCardTransactionModel.deleteMany({ user: userId, expenseRef: expense._id }); await expense.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) { if (error instanceof Response) return error; const message = error instanceof Error ? error.message : "Unable to delete expense."; return NextResponse.json({ error: message }, { status: message === "Expense entry not found." ? 404 : 400 }); }
}
