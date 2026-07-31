import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import CreditCardBillModel from "@/models/CreditCardBill";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";
import ExpenseModel from "@/models/Expense";
import IncomeModel from "@/models/Income";
import InvestmentModel from "@/models/Investment";
import InvestmentContributionModel from "@/models/InvestmentContribution";
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
      paidContributions,
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
      InvestmentContributionModel.find({ user, status: "Paid" }).lean(),
      CashModel.findOne({ user }).lean(),
    ]);

    const isInPeriod = (d: Date | string | null | undefined) => {
      if (!d) return false;
      if (!periodDate) return true;
      const dateVal = new Date(d);
      return dateVal >= periodDate.$gte && dateVal < periodDate.$lt;
    };

    const incomeTotal = sum(income, "amount"),
      allIncomeTotal = sum(allIncome, "amount");

    // Filter out Investment and Lending from actual expenses
    const periodExpensesActual = expenses.filter(
      (e) => e.category !== "Investment" && e.category !== "Lending"
    );
    const allExpensesActual = allExpenses.filter(
      (e) => e.category !== "Investment" && e.category !== "Lending"
    );

    const expenseTotal = sum(periodExpensesActual, "amount"),
      allExpenseTotal = sum(allExpensesActual, "amount");

    // Calculate Investments
    const periodLumpsumInvestments = investments.filter((inv) => {
      const isLumpsum = inv.category === "Market-Linked" || inv.investmentMode === "Lumpsum";
      return isLumpsum && isInPeriod(inv.date || inv.startDate);
    });
    const lumpsumInvAmount = sum(periodLumpsumInvestments, "amountInvested");
    const periodRecurringInvestments = paidContributions.filter((c) => isInPeriod(c.paidDate || c.dueDate));
    const recurringInvAmount = sum(periodRecurringInvestments, "amount");
    const investmentTotal = lumpsumInvAmount + recurringInvAmount;

    const allLumpsumInvestments = investments.filter(
      (inv) => inv.category === "Market-Linked" || inv.investmentMode === "Lumpsum"
    );
    const allLumpsumInvAmount = sum(allLumpsumInvestments, "amountInvested");
    const allRecurringInvAmount = sum(paidContributions, "amount");
    const allInvestmentTotal = allLumpsumInvAmount + allRecurringInvAmount;

    // Calculate Lending Given (lent out)
    const periodLendingGiven = lending.filter((l) => l.type === "Given" && isInPeriod(l.date));
    const lendingGivenTotal = sum(periodLendingGiven, "amount");
    const allLendingGivenTotal = sum(lending.filter((l) => l.type === "Given"), "amount");

    // Calculate Lending Taken (borrowed)
    const periodLendingTaken = lending.filter((l) => l.type === "Taken" && isInPeriod(l.date));
    const lendingTakenTotal = sum(periodLendingTaken, "amount");
    const allLendingTakenTotal = sum(lending.filter((l) => l.type === "Taken"), "amount");

    const investmentValue = sum(investments, "currentValue"),
      investmentCost = sum(investments, "amountInvested");
    const pendingGiven = lending
      .filter((entry) => entry.type === "Given")
      .reduce((total, entry) => total + entry.amount - entry.amountReturned, 0);
    const pendingTaken = lending
      .filter((entry) => entry.type === "Taken")
      .reduce((total, entry) => total + entry.amount - entry.amountReturned, 0);

    const category = Object.entries(
      periodExpensesActual.reduce<Record<string, number>>((all, entry) => {
        all[entry.category] = (all[entry.category] ?? 0) + entry.amount;
        return all;
      }, {})
    ).map(([name, value]) => ({ name, value }));

    const currentYear = new Date().getFullYear();
    const targetYear = Number.isInteger(year) && year > 2000 ? year : currentYear;
    const targetMonth = Number.isInteger(month) && month >= 1 && month <= 12 ? month - 1 : new Date().getMonth();

    const monthlyTrendMap = new Map<
      string,
      {
        month: string;
        income: number;
        expense: number;
        investment: number;
        lendingGiven: number;
        lendingTaken: number;
      }
    >();

    const isAllMonths = params.get("month") === "all" || !params.get("month");

    if (isAllMonths) {
      for (let m = 0; m < 12; m++) {
        const key = `${targetYear}-${String(m + 1).padStart(2, "0")}`;
        monthlyTrendMap.set(key, {
          month: key,
          income: 0,
          expense: 0,
          investment: 0,
          lendingGiven: 0,
          lendingTaken: 0,
        });
      }
    } else {
      for (let offset = 11; offset >= 0; offset--) {
        const d = new Date(Date.UTC(targetYear, targetMonth - offset, 1));
        const key = d.toISOString().slice(0, 7);
        monthlyTrendMap.set(key, {
          month: key,
          income: 0,
          expense: 0,
          investment: 0,
          lendingGiven: 0,
          lendingTaken: 0,
        });
      }
    }

    const yearlyTrendMap = new Map<
      string,
      {
        year: string;
        income: number;
        expense: number;
        investment: number;
        lendingGiven: number;
        lendingTaken: number;
      }
    >();
    const startYear = targetYear - 4;
    for (let y = startYear; y <= targetYear; y++) {
      const key = String(y);
      yearlyTrendMap.set(key, {
        year: key,
        income: 0,
        expense: 0,
        investment: 0,
        lendingGiven: 0,
        lendingTaken: 0,
      });
    }

    allIncome.forEach((row) => {
      if (!row.date) return;
      const dateStr = new Date(row.date).toISOString();
      const mKey = dateStr.slice(0, 7);
      const yKey = dateStr.slice(0, 4);

      const mItem = monthlyTrendMap.get(mKey);
      if (mItem) mItem.income += row.amount;

      const yItem = yearlyTrendMap.get(yKey);
      if (yItem) yItem.income += row.amount;
    });

    allExpenses.forEach((row) => {
      if (!row.date || row.category === "Investment" || row.category === "Lending") return;
      const dateStr = new Date(row.date).toISOString();
      const mKey = dateStr.slice(0, 7);
      const yKey = dateStr.slice(0, 4);

      const mItem = monthlyTrendMap.get(mKey);
      if (mItem) mItem.expense += row.amount;

      const yItem = yearlyTrendMap.get(yKey);
      if (yItem) yItem.expense += row.amount;
    });

    investments.forEach((row) => {
      const isLumpsum = row.category === "Market-Linked" || row.investmentMode === "Lumpsum";
      if (!isLumpsum) return;
      const dateVal = row.date || row.startDate;
      if (!dateVal) return;
      const dateStr = new Date(dateVal).toISOString();
      const mKey = dateStr.slice(0, 7);
      const yKey = dateStr.slice(0, 4);

      const mItem = monthlyTrendMap.get(mKey);
      if (mItem) mItem.investment += row.amountInvested;

      const yItem = yearlyTrendMap.get(yKey);
      if (yItem) yItem.investment += row.amountInvested;
    });

    paidContributions.forEach((row) => {
      const dateVal = row.paidDate || row.dueDate;
      if (!dateVal) return;
      const dateStr = new Date(dateVal).toISOString();
      const mKey = dateStr.slice(0, 7);
      const yKey = dateStr.slice(0, 4);

      const mItem = monthlyTrendMap.get(mKey);
      if (mItem) mItem.investment += row.amount;

      const yItem = yearlyTrendMap.get(yKey);
      if (yItem) yItem.investment += row.amount;
    });

    lending.forEach((row) => {
      if (!row.date) return;
      const dateStr = new Date(row.date).toISOString();
      const mKey = dateStr.slice(0, 7);
      const yKey = dateStr.slice(0, 4);

      const mItem = monthlyTrendMap.get(mKey);
      if (mItem) {
        if (row.type === "Given") mItem.lendingGiven += row.amount;
        else if (row.type === "Taken") mItem.lendingTaken += row.amount;
      }

      const yItem = yearlyTrendMap.get(yKey);
      if (yItem) {
        if (row.type === "Given") yItem.lendingGiven += row.amount;
        else if (row.type === "Taken") yItem.lendingTaken += row.amount;
      }
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
      period: {
        income: incomeTotal,
        expense: expenseTotal,
        investment: investmentTotal,
        lendingGiven: lendingGivenTotal,
        lendingTaken: lendingTakenTotal,
        netSavings: incomeTotal - expenseTotal,
      },
      allTime: {
        income: allIncomeTotal,
        expense: allExpenseTotal,
        investment: allInvestmentTotal,
        lendingGiven: allLendingGivenTotal,
        lendingTaken: allLendingTakenTotal,
        netSavings: allIncomeTotal - allExpenseTotal,
      },
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
        minimumBalance: account.minimumBalance ?? 0,
      })),
      expenseCategories: category,
      trend: [...monthlyTrendMap.values()],
      monthlyTrend: [...monthlyTrendMap.values()],
      yearlyTrend: [...yearlyTrendMap.values()],
      recent,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load dashboard." },
      { status: 500 }
    );
  }
}
