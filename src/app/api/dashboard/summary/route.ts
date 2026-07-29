import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import CreditCardBillModel from "@/models/CreditCardBill";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";
import ExpenseModel from "@/models/Expense";
import IncomeModel from "@/models/Income";
import InvestmentModel from "@/models/Investment";
import LendingModel from "@/models/Lending";
import CashModel from "@/models/Cash";
const sum = (
  items: { amount?: number; currentValue?: number; amountInvested?: number }[],
  key: "amount" | "currentValue" | "amountInvested"
) => items.reduce((total, item) => total + (item[key] ?? 0), 0);
export async function GET(request: NextRequest) {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");
    const user = session.userId;
    const params = request.nextUrl.searchParams;
    const year = Number(params.get("year"));
    const month = Number(params.get("month"));
    const periodDate =
      Number.isInteger(year) && year > 2000
        ? {
            $gte: new Date(Date.UTC(year, Number.isInteger(month) && month > 0 ? month - 1 : 0, 1)),
            $lt: new Date(Date.UTC(year, Number.isInteger(month) && month > 0 ? month : 12, 1)),
          }
        : undefined;
    const period = { user, ...(periodDate ? { date: periodDate } : {}) };
    const [
      income,
      expenses,
      allIncome,
      allExpenses,
      investments,
      lending,
      accounts,
      bills,
      currentCard,
      recentIncome,
      recentExpenses,
      recentLending,
      monthlyIncome,
      monthlyExpenses,
      cash,
    ] = await Promise.all([
      IncomeModel.find(period).lean(),
      ExpenseModel.find(period).lean(),
      IncomeModel.find({ user }).lean(),
      ExpenseModel.find({ user }).lean(),
      InvestmentModel.find({ user }).lean(),
      LendingModel.find({ user }).lean(),
      BankAccountModel.find({ user }).lean(),
      CreditCardBillModel.find({ user, isPaid: false }).lean(),
      CreditCardTransactionModel.find({ user, billed: false }).lean(),
      IncomeModel.find({ user }).sort({ date: -1 }).limit(10).lean(),
      ExpenseModel.find({ user }).sort({ date: -1 }).limit(10).lean(),
      LendingModel.find({ user }).sort({ date: -1 }).limit(10).lean(),
      IncomeModel.aggregate([
        {
          $match: {
            user: (await import("mongoose")).default.Types.ObjectId.createFromHexString(user),
            date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) },
          },
        },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, amount: { $sum: "$amount" } } },
      ]),
      ExpenseModel.aggregate([
        {
          $match: {
            user: (await import("mongoose")).default.Types.ObjectId.createFromHexString(user),
            date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) },
          },
        },
        { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, amount: { $sum: "$amount" } } },
      ]),
      CashModel.findOne({ user }).lean(),
    ]);
    const incomeTotal = sum(income, "amount"),
      expenseTotal = sum(expenses, "amount"),
      allIncomeTotal = sum(allIncome, "amount"),
      allExpenseTotal = sum(allExpenses, "amount");
    const investmentValue = sum(investments, "currentValue"),
      investmentCost = sum(investments, "amountInvested");
    const pendingGiven = lending
      .filter((entry) => entry.type === "Given")
      .reduce((total, entry) => total + entry.amount - entry.amountReturned, 0);
    const pendingTaken = lending
      .filter((entry) => entry.type === "Taken")
      .reduce((total, entry) => total + entry.amount - entry.amountReturned, 0);
    const category = Object.entries(
      expenses.reduce<Record<string, number>>((all, entry) => {
        all[entry.category] = (all[entry.category] ?? 0) + entry.amount;
        return all;
      }, {})
    ).map(([name, value]) => ({ name, value }));
    const trendMap = new Map<string, { month: string; income: number; expense: number }>();
    for (let offset = 11; offset >= 0; offset--) {
      const key = new Date(new Date().getFullYear(), new Date().getMonth() - offset, 1).toISOString().slice(0, 7);
      trendMap.set(key, { month: key, income: 0, expense: 0 });
    }
    monthlyIncome.forEach((row) => {
      const item = trendMap.get(row._id);
      if (item) item.income = row.amount;
    });
    monthlyExpenses.forEach((row) => {
      const item = trendMap.get(row._id);
      if (item) item.expense = row.amount;
    });
    const people = (type: "Given" | "Taken") =>
      Object.values(
        lending
          .filter((entry) => entry.type === type)
          .reduce<Record<string, { person: string; pending: number }>>((all, entry) => {
            const value = all[entry.person] ?? { person: entry.person, pending: 0 };
            value.pending += entry.amount - entry.amountReturned;
            all[entry.person] = value;
            return all;
          }, {})
      )
        .filter((entry) => entry.pending > 0)
        .sort((a, b) => b.pending - a.pending)
        .slice(0, 5);
    const recent = [
      ...recentIncome.map((entry) => ({ type: "Income", date: entry.date, title: entry.source, amount: entry.amount })),
      ...recentExpenses.map((entry) => ({
        type: "Expense",
        date: entry.date,
        title: entry.source || entry.category,
        amount: entry.amount,
      })),
      ...recentLending.map((entry) => ({
        type: entry.type === "Given" ? "Lending" : "Borrowing",
        date: entry.date,
        title: entry.person,
        amount: entry.amount,
      })),
    ]
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 10);
    return NextResponse.json({
      period: { income: incomeTotal, expense: expenseTotal, netSavings: incomeTotal - expenseTotal },
      allTime: { income: allIncomeTotal, expense: allExpenseTotal, netSavings: allIncomeTotal - allExpenseTotal },
      investments: {
        value: investmentValue,
        gain: investmentValue - investmentCost,
        distribution: investments.reduce<Record<string, number>>((all, entry) => {
          all[entry.type] = (all[entry.type] ?? 0) + (entry.currentValue ?? entry.amountInvested);
          return all;
        }, {}),
      },
      lending: { pendingGiven, pendingTaken, owedToMe: people("Given"), iOwe: people("Taken") },
      creditOutstanding:
        bills.reduce((total, bill) => total + bill.totalAmount, 0) +
        currentCard.reduce((total, entry) => total + entry.amount, 0),
      bankBalance: accounts.reduce((total, account) => total + account.currentBalance, 0),
      cashBalance: cash ? cash.balance : 0,
      accounts: accounts.map((account) => ({
        id: account._id.toString(),
        name: account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName,
        bankName: account.bankName,
        last4Digits: account.last4Digits,
        currentBalance: account.currentBalance,
        themeColor: account.themeColor,
      })),
      expenseCategories: category,
      trend: [...trendMap.values()],
      recent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load dashboard." },
      { status: 500 }
    );
  }
}
