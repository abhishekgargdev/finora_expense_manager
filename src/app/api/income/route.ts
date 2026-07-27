import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import IncomeModel from "@/models/Income";

const PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Other"] as const;

type IncomeInput = {
  amount?: unknown;
  source?: unknown;
  category?: unknown;
  date?: unknown;
  note?: unknown;
  paymentMode?: unknown;
  bankAccount?: unknown;
};

export type IncomeRecord = {
  id: string;
  amount: number;
  source: string;
  category?: string;
  date: string;
  note?: string;
  paymentMode: string;
  bankAccount?: string | null;
};

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function parseIncome(input: IncomeInput, partial = false) {
  const values: Record<string, unknown> = {};

  if (!partial || input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
    values.amount = amount;
  }
  if (!partial || input.source !== undefined) {
    const source = asString(input.source);
    if (!source) throw new Error("Source is required.");
    values.source = source;
  }
  if (!partial || input.date !== undefined) {
    const date = new Date(asString(input.date));
    if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
    values.date = date;
  }
  if (!partial || input.paymentMode !== undefined) {
    const paymentMode = asString(input.paymentMode);
    if (!PAYMENT_MODES.includes(paymentMode as (typeof PAYMENT_MODES)[number])) throw new Error("Choose a valid payment mode.");
    values.paymentMode = paymentMode;
  }
  if (input.category !== undefined || !partial) values.category = asString(input.category) || undefined;
  if (input.note !== undefined || !partial) values.note = asString(input.note) || undefined;
  if (input.bankAccount !== undefined || !partial) values.bankAccount = asString(input.bankAccount) || undefined;

  return values;
}

export function serializeIncome(entry: {
  _id: { toString(): string };
  amount: number;
  source: string;
  category?: string;
  date: Date;
  note?: string;
  paymentMode: string;
  bankAccount?: { _id?: { toString(): string }; toString(): string } | null;
}): IncomeRecord {
  const bankAccount = entry.bankAccount && typeof entry.bankAccount === "object" && "_id" in entry.bankAccount
    ? entry.bankAccount._id?.toString()
    : entry.bankAccount?.toString();

  return {
    id: entry._id.toString(),
    amount: entry.amount,
    source: entry.source,
    category: entry.category,
    date: entry.date.toISOString(),
    note: entry.note,
    paymentMode: entry.paymentMode,
    bankAccount: bankAccount ?? null,
  };
}

export async function getUserId() {
  const session = await requireAuth();
  if (typeof session.userId !== "string") throw new Error("Unauthorized");
  return session.userId;
}

export async function ensureBankAccount(userId: string, bankAccount?: unknown) {
  const bankAccountId = asString(bankAccount);
  if (!bankAccountId) return undefined;
  const account = await BankAccountModel.findOne({ _id: bankAccountId, user: userId }).select("_id").lean();
  if (!account) throw new Error("The selected bank account was not found.");
  return bankAccountId;
}

export async function GET(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const params = request.nextUrl.searchParams;
    const query: Record<string, unknown> = { user: userId };
    const year = Number(params.get("year"));
    const month = Number(params.get("month"));

    if (Number.isInteger(year) && year >= 2000 && year <= 2200) {
      const startMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : 0;
      const end = new Date(Date.UTC(year, startMonth + (startMonth === 0 && !month ? 12 : 1), 1));
      query.date = { $gte: new Date(Date.UTC(year, startMonth, 1)), $lt: end };
    }
    const category = asString(params.get("category"));
    if (category) query.category = category;

    const sorts: Record<string, Record<string, 1 | -1>> = {
      oldest: { date: 1 },
      amount_asc: { amount: 1 },
      amount_desc: { amount: -1 },
      newest: { date: -1 },
    };
    const sort = sorts[params.get("sort") ?? "newest"] ?? sorts.newest;
    const [income, bankAccounts] = await Promise.all([
      IncomeModel.find(query).sort(sort).lean(),
      BankAccountModel.find({ user: userId }).sort({ bankName: 1 }).select("bankName accountName last4Digits").lean(),
    ]);

    return NextResponse.json({
      income: income.map(serializeIncome),
      bankAccounts: bankAccounts.map((account) => ({
        id: account._id.toString(),
        name: account.accountName || account.bankName,
        bankName: account.bankName,
        last4Digits: account.last4Digits,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load income." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const input = parseIncome(await request.json());
    const bankAccount = await ensureBankAccount(userId, input.bankAccount);
    const income = await IncomeModel.create({ ...input, bankAccount, user: userId });

    if (bankAccount) {
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount,
        type: "Credit",
        amount: income.amount,
        description: `Income: ${income.source}`,
        date: income.date,
        source: "Income",
        refId: income._id,
      });
    }

    return NextResponse.json({ income: serializeIncome(income) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create income." }, { status: 400 });
  }
}
