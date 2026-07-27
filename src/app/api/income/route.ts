import { NextRequest, NextResponse } from "next/server";

import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import IncomeModel from "@/models/Income";

import { ensureBankAccount, getUserId, parseIncome, serializeIncome, text as asString } from "@/lib/income-api";


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
