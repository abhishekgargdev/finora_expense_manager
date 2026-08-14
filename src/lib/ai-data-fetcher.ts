import connect from "./db";
import IncomeModel from "@/models/Income";
import ExpenseModel from "@/models/Expense";
import InvestmentModel from "@/models/Investment";
import InvestmentContributionModel from "@/models/InvestmentContribution";
import BankAccountModel from "@/models/BankAccount";
import CashModel from "@/models/Cash";

export interface AIFinancialProfile {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalInvested: number;
    netSavings: number;
    savingsRatePercentage: number;
    bankBalance: number;
    cashBalance: number;
  };
  incomeRecords: Array<{
    amount: number;
    source: string;
    category?: string;
    date: string;
    paymentMode: string;
    note?: string;
  }>;
  expenseSummary: {
    categoryBreakdown: Record<string, number>;
    monthlyTrend: Array<{
      month: string;
      expense: number;
    }>;
    recentExpenses: Array<{
      amount: number;
      source?: string;
      category: string;
      date: string;
      paymentMode: string;
      description?: string;
      note?: string;
    }>;
  };
  investmentRecords: Array<{
    type: string;
    name?: string;
    amountInvested: number;
    currentValue?: number;
    date: string;
    category: string;
    status: string;
    interestRate?: number;
    maturityDate?: string;
    note?: string;
  }>;
}

/**
 * Fetches and formats complete income, summarized expenses, and investment data for a user.
 */
export async function getFinancialDataForAI(userId: string): Promise<AIFinancialProfile> {
  // Ensure database is connected
  await connect();

  // Fetch all user records in parallel
  const [
    incomes,
    expenses,
    investments,
    contributions,
    bankAccounts,
    cashRecord,
  ] = await Promise.all([
    IncomeModel.find({ user: userId }).sort({ date: -1 }).lean(),
    ExpenseModel.find({ user: userId }).sort({ date: -1 }).lean(),
    InvestmentModel.find({ user: userId }).sort({ date: -1 }).lean(),
    InvestmentContributionModel.find({ user: userId, status: "Paid" }).lean(),
    BankAccountModel.find({ user: userId }).lean(),
    CashModel.findOne({ user: userId }).lean(),
  ]);

  // 1. Calculate Income Summaries
  const totalIncome = incomes.reduce((sum, item) => sum + (item.amount || 0), 0);
  const formattedIncomes = incomes.map((inc) => ({
    amount: inc.amount,
    source: inc.source,
    category: inc.category,
    date: inc.date ? new Date(inc.date).toISOString().split("T")[0] : "",
    paymentMode: inc.paymentMode,
    note: inc.note,
  }));

  // 2. Filter & Calculate Expense Summaries (excluding pure Investment and Lending categories)
  const actualExpenses = expenses.filter(
    (e) => e.category !== "Investment" && e.category !== "Lending"
  );
  const totalExpenses = actualExpenses.reduce((sum, item) => sum + (item.amount || 0), 0);

  // Group expenses by category
  const categoryBreakdown: Record<string, number> = {};
  actualExpenses.forEach((exp) => {
    categoryBreakdown[exp.category] = (categoryBreakdown[exp.category] || 0) + exp.amount;
  });

  // Calculate monthly trend (last 12 months)
  const monthlyTrendMap: Record<string, number> = {};
  // Pre-fill the last 12 months
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() - i, 1));
    const monthKey = d.toISOString().slice(0, 7); // "YYYY-MM"
    monthlyTrendMap[monthKey] = 0;
  }

  actualExpenses.forEach((exp) => {
    if (!exp.date) return;
    const monthKey = new Date(exp.date).toISOString().slice(0, 7);
    if (monthlyTrendMap[monthKey] !== undefined) {
      monthlyTrendMap[monthKey] += exp.amount;
    }
  });

  const monthlyTrend = Object.entries(monthlyTrendMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, expense]) => ({ month, expense }));

  // Get the 30 most recent actual expenses
  const recentExpenses = actualExpenses.slice(0, 30).map((exp) => ({
    amount: exp.amount,
    source: exp.source,
    category: exp.category,
    date: exp.date ? new Date(exp.date).toISOString().split("T")[0] : "",
    paymentMode: exp.paymentMode,
    description: exp.description,
    note: exp.note,
  }));

  // 3. Calculate Investments
  // Total lumpsum investments
  const lumpsumInvested = investments
    .filter((inv) => inv.category === "Market-Linked" || inv.investmentMode === "Lumpsum")
    .reduce((sum, inv) => sum + (inv.amountInvested || 0), 0);
  
  // Total recurring contribution investments
  const recurringInvested = contributions.reduce((sum, c) => sum + (c.amount || 0), 0);
  const totalInvested = lumpsumInvested + recurringInvested;

  const formattedInvestments = investments.map((inv) => ({
    type: inv.type,
    name: inv.name || inv.planName,
    amountInvested: inv.amountInvested,
    currentValue: inv.currentValue,
    date: inv.date ? new Date(inv.date).toISOString().split("T")[0] : "",
    category: inv.category,
    status: inv.status || "Active",
    interestRate: inv.interestRate,
    maturityDate: inv.maturityDate ? new Date(inv.maturityDate).toISOString().split("T")[0] : undefined,
    note: inv.note,
  }));

  // 4. Balances
  const bankBalance = bankAccounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0);
  const cashBalance = cashRecord ? cashRecord.balance : 0;

  // 5. Overall Net Savings
  const netSavings = totalIncome - totalExpenses;
  const savingsRatePercentage = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  return {
    summary: {
      totalIncome,
      totalExpenses,
      totalInvested,
      netSavings,
      savingsRatePercentage: Math.round(savingsRatePercentage * 100) / 100,
      bankBalance,
      cashBalance,
    },
    incomeRecords: formattedIncomes,
    expenseSummary: {
      categoryBreakdown,
      monthlyTrend,
      recentExpenses,
    },
    investmentRecords: formattedInvestments,
  };
}
