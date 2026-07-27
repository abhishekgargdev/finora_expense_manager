import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import CreditCardModel from "@/models/CreditCard";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";
import ExpenseModel from "@/models/Expense";

const PAYMENT_MODES = ["Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer"] as const;

type ExpenseInput = { amount?: unknown; source?: unknown; category?: unknown; date?: unknown; paymentMode?: unknown; bankAccount?: unknown; creditCard?: unknown; note?: unknown };

export type ExpenseRecord = { id: string; amount: number; source?: string; category: string; date: string; paymentMode: string; bankAccount?: string | null; creditCard?: string | null; note?: string };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export function parseExpense(input: ExpenseInput, partial = false) {
  const values: Record<string, unknown> = {};
  if (!partial || input.amount !== undefined) { const amount = Number(input.amount); if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero."); values.amount = amount; }
  if (!partial || input.category !== undefined) { const category = text(input.category); if (!category) throw new Error("Category is required."); values.category = category; }
  if (!partial || input.date !== undefined) { const date = new Date(text(input.date)); if (Number.isNaN(date.getTime())) throw new Error("A valid date is required."); values.date = date; }
  if (!partial || input.paymentMode !== undefined) { const paymentMode = text(input.paymentMode); if (!PAYMENT_MODES.includes(paymentMode as (typeof PAYMENT_MODES)[number])) throw new Error("Choose a valid payment mode."); values.paymentMode = paymentMode; }
  if (input.source !== undefined || !partial) values.source = text(input.source) || undefined;
  if (input.note !== undefined || !partial) values.note = text(input.note) || undefined;
  if (input.bankAccount !== undefined || !partial) values.bankAccount = text(input.bankAccount) || undefined;
  if (input.creditCard !== undefined || !partial) values.creditCard = text(input.creditCard) || undefined;
  return values;
}

export function serializeExpense(entry: { _id: { toString(): string }; amount: number; source?: string; category: string; date: Date; paymentMode: string; bankAccount?: { toString(): string } | null; creditCard?: { toString(): string } | null; note?: string }): ExpenseRecord {
  return { id: entry._id.toString(), amount: entry.amount, source: entry.source, category: entry.category, date: entry.date.toISOString(), paymentMode: entry.paymentMode, bankAccount: entry.bankAccount?.toString() ?? null, creditCard: entry.creditCard?.toString() ?? null, note: entry.note };
}

export async function getUserId() { const session = await requireAuth(); if (typeof session.userId !== "string") throw new Error("Unauthorized"); return session.userId; }
export async function ensureBankAccount(userId: string, value?: unknown) { const id = text(value); if (!id) return undefined; const account = await BankAccountModel.exists({ _id: id, user: userId }); if (!account) throw new Error("The selected bank account was not found."); return id; }
export async function ensureCreditCard(userId: string, value?: unknown) { const id = text(value); if (!id) return undefined; const card = await CreditCardModel.exists({ _id: id, user: userId }); if (!card) throw new Error("The selected credit card was not found."); return id; }

function dateFilter(params: URLSearchParams) {
  const year = Number(params.get("year")); const month = Number(params.get("month"));
  if (!Number.isInteger(year) || year < 2000 || year > 2200) return undefined;
  const hasMonth = Number.isInteger(month) && month >= 1 && month <= 12;
  const startMonth = hasMonth ? month - 1 : 0;
  return { $gte: new Date(Date.UTC(year, startMonth, 1)), $lt: new Date(Date.UTC(year, hasMonth ? startMonth + 1 : 12, 1)) };
}

export async function GET(request: NextRequest) {
  try {
    await connect(); const userId = await getUserId(); const params = request.nextUrl.searchParams;
    const query: Record<string, unknown> = { user: userId }; const dates = dateFilter(params); if (dates) query.date = dates;
    const category = text(params.get("category")); if (category) query.category = category;
    const sorts: Record<string, Record<string, 1 | -1>> = { newest: { date: -1 }, oldest: { date: 1 }, amount_asc: { amount: 1 }, amount_desc: { amount: -1 } };
    const [expenses, bankAccounts, creditCards] = await Promise.all([
      ExpenseModel.find(query).sort(sorts[params.get("sort") ?? "newest"] ?? sorts.newest).lean(),
      BankAccountModel.find({ user: userId }).sort({ bankName: 1 }).select("bankName accountName last4Digits").lean(),
      CreditCardModel.find({ user: userId }).sort({ cardName: 1 }).select("cardName bankName last4Digits").lean(),
    ]);
    return NextResponse.json({ expenses: expenses.map(serializeExpense), bankAccounts: bankAccounts.map((account) => ({ id: account._id.toString(), name: account.accountName || account.bankName, last4Digits: account.last4Digits })), creditCards: creditCards.map((card) => ({ id: card._id.toString(), name: card.cardName, bankName: card.bankName, last4Digits: card.last4Digits })) });
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load expenses." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    await connect(); const userId = await getUserId(); const input = parseExpense(await request.json());
    const bankAccount = await ensureBankAccount(userId, input.bankAccount); const creditCard = await ensureCreditCard(userId, input.creditCard);
    if (input.paymentMode === "Credit Card" && !creditCard) throw new Error("Choose a credit card.");
    if (["UPI", "Debit Card", "Bank Transfer"].includes(String(input.paymentMode)) && !bankAccount) throw new Error("Choose a bank account.");
    const expense = await ExpenseModel.create({ ...input, bankAccount, creditCard, user: userId });
    if (bankAccount) await BankTransactionModel.recordTransaction({ user: userId, bankAccount, type: "Debit", amount: expense.amount, description: `Expense: ${expense.source || expense.category}`, date: expense.date, source: "Expense", refId: expense._id });
    if (creditCard) await CreditCardTransactionModel.create({ user: userId, creditCard, amount: expense.amount, description: expense.source || expense.category, date: expense.date, expenseRef: expense._id });
    return NextResponse.json({ expense: serializeExpense(expense) }, { status: 201 });
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create expense." }, { status: 400 }); }
}
