import { NextRequest, NextResponse } from "next/server";

import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import CreditCardModel from "@/models/CreditCard";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";
import ExpenseModel from "@/models/Expense";
import CashTransactionModel from "@/models/CashTransaction";

import {
  ensureBankAccount,
  ensureCreditCard,
  getUserId,
  parseExpense,
  serializeExpense,
  text,
} from "@/lib/expenses-api";

function dateFilter(params: URLSearchParams) {
  const year = Number(params.get("year"));
  const month = Number(params.get("month"));
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return undefined;
  const hasMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  const startMonth = hasMonth ? month - 1 : 0;
  return {
    $gte: new Date(Date.UTC(year, startMonth, 1)),
    $lt: new Date(Date.UTC(year, hasMonth ? startMonth + 1 : 12, 1)),
  };
}

export async function GET(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const params = request.nextUrl.searchParams;
    const query: Record<string, unknown> = { user: userId };
    const dates = dateFilter(params);
    if (dates) query.date = dates;
    const category = text(params.get("category"));
    if (category) query.category = category;
    const sorts: Record<string, Record<string, 1 | -1>> = {
      newest: { date: -1 },
      oldest: { date: 1 },
      amount_asc: { amount: 1 },
      amount_desc: { amount: -1 },
    };
    const [expenses, bankAccounts, creditCards] = await Promise.all([
      ExpenseModel.find(query)
        .sort(sorts[params.get("sort") ?? "newest"] ?? sorts.newest)
        .lean(),
      BankAccountModel.find({ user: userId }).sort({ bankName: 1 }).select("bankName accountName last4Digits").lean(),
      CreditCardModel.find({ user: userId }).sort({ cardName: 1 }).select("cardName bankName last4Digits").lean(),
    ]);
    return NextResponse.json({
      expenses: expenses.map(serializeExpense),
      bankAccounts: bankAccounts.map((account) => ({
        id: account._id.toString(),
        name: account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName,
        last4Digits: account.last4Digits,
      })),
      creditCards: creditCards.map((card) => ({
        id: card._id.toString(),
        name: card.cardName,
        bankName: card.bankName,
        last4Digits: card.last4Digits,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load expenses." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const input = parseExpense(await request.json());
    const bankAccount = await ensureBankAccount(userId, input.bankAccount);
    const creditCard = await ensureCreditCard(userId, input.creditCard);
    if (input.paymentMode === "Credit Card" && !creditCard) throw new Error("Choose a credit card.");
    if (["UPI", "Debit Card", "Bank Transfer"].includes(String(input.paymentMode)) && !bankAccount)
      throw new Error("Choose a bank account.");
    const expense = await ExpenseModel.create({ ...input, bankAccount, creditCard, user: userId });
    if (input.paymentMode === "Cash")
      await CashTransactionModel.recordTransaction({
        user: userId,
        type: "Debit",
        amount: expense.amount,
        description: `Expense: ${expense.source || expense.category}`,
        date: expense.date,
        source: "Expense",
        refId: expense._id,
      });
    if (bankAccount)
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount,
        type: "Debit",
        amount: expense.amount,
        description: `Expense: ${expense.source || expense.category}`,
        date: expense.date,
        source: "Expense",
        refId: expense._id,
      });
    if (creditCard)
      await CreditCardTransactionModel.create({
        user: userId,
        creditCard,
        amount: expense.amount,
        description: expense.source || expense.category,
        date: expense.date,
        expenseRef: expense._id,
      });
    return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create expense." },
      { status: 400 }
    );
  }
}
