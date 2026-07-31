import { NextRequest, NextResponse } from "next/server";
import { addMonths } from "date-fns";

import connect from "@/lib/db";
import mongoose from "mongoose";
import InvestmentModel from "@/models/Investment";
import InvestmentContributionModel from "@/models/InvestmentContribution";
import ExpenseModel from "@/models/Expense";
import BankTransactionModel from "@/models/BankTransaction";
import { getUserId, parseInvestment, serializeInvestment } from "@/lib/investments-api";
import {
  calculateMaturityDate,
  calculateLumpsumMaturity,
  calculateRecurringMaturity,
} from "@/lib/investment-calculations";

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export async function GET(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const params = request.nextUrl.searchParams;
    const query: Record<string, unknown> = { user: userId };
    const year = Number(params.get("year"));
    const month = Number(params.get("month"));
    if (Number.isInteger(year) && year >= 2000 && year <= 2200) {
      const hasMonth = Number.isInteger(month) && month >= 1 && month <= 12;
      const start = hasMonth ? month - 1 : 0;
      query.date = {
        $gte: new Date(Date.UTC(year, start, 1)),
        $lt: new Date(Date.UTC(year, hasMonth ? start + 1 : 12, 1)),
      };
    }
    const type = text(params.get("type") ?? params.get("category"));
    if (type) {
      if (type === "Market-Linked" || type === "Fixed-Tenure") {
        query.category = type;
      } else {
        query.type = type;
      }
    }
    const sorts: Record<string, Record<string, 1 | -1>> = {
      newest: { date: -1 },
      oldest: { date: 1 },
      amount_asc: { amountInvested: 1 },
      amount_desc: { amountInvested: -1 },
    };
    const investments = await InvestmentModel.find(query)
      .sort(sorts[params.get("sort") ?? "newest"] ?? sorts.newest)
      .lean();

    const contribCounts = await InvestmentContributionModel.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: "$investment",
          total: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, 1, 0] } },
        },
      },
    ]);
    const countsMap = new Map(contribCounts.map((c) => [c._id.toString(), { total: c.total, paid: c.paid }]));

    return NextResponse.json({ investments: investments.map((item) => serializeInvestment(item, countsMap)) });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load investments." },
      { status: 500 }
    );
  }
}


export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const parsed = parseInvestment(await request.json());

    if (parsed.category === "Fixed-Tenure") {
      const start = new Date(parsed.startDate);
      const tenureValue = Number(parsed.tenureValue);
      const tenureUnit = parsed.tenureUnit;

      if (!parsed.maturityDate) {
        parsed.maturityDate = calculateMaturityDate(start, tenureValue, tenureUnit);
      }

      parsed.date = start; // align search date with investment start date

      if (!parsed.expectedMaturityAmount) {
        if (parsed.investmentMode === "Lumpsum") {
          const principal = Number(parsed.principalAmount);
          const rate = Number(parsed.interestRate);
          const compounding = parsed.compoundingFrequency || "Quarterly";
          parsed.expectedMaturityAmount = calculateLumpsumMaturity(
            principal,
            rate,
            start,
            parsed.maturityDate,
            compounding
          );
        } else if (parsed.investmentMode === "Recurring") {
          const installment = Number(parsed.installmentAmount);
          const rate = Number(parsed.interestRate);
          const freq = parsed.installmentFrequency || "Monthly";
          const tenureInMonths = tenureUnit === "Years" ? tenureValue * 12 : tenureValue;
          const totalInstallments = freq === "Quarterly" ? Math.round(tenureInMonths / 3) : tenureInMonths;
          parsed.expectedMaturityAmount = calculateRecurringMaturity(
            installment,
            rate,
            freq,
            totalInstallments
          );
        }
      }

      if (parsed.investmentMode === "Lumpsum") {
        parsed.amountInvested = Number(parsed.principalAmount);
        parsed.currentValue = parsed.currentValue !== undefined ? Number(parsed.currentValue) : Number(parsed.principalAmount);
      } else {
        parsed.amountInvested = parsed.amountInvested !== undefined ? Number(parsed.amountInvested) : 0;
        parsed.currentValue = parsed.currentValue !== undefined ? Number(parsed.currentValue) : 0;
      }
    } else {
      if (parsed.amountInvested === undefined) {
        throw new Error("Amount invested is required.");
      }
      if (parsed.currentValue === undefined) {
        parsed.currentValue = parsed.amountInvested;
      }
    }

    const investment = await InvestmentModel.create({ ...parsed, user: userId });

    // Log Expense and record BankTransaction if Fixed-Tenure Lumpsum has bankAccount
    if (
      investment.category === "Fixed-Tenure" &&
      investment.investmentMode === "Lumpsum" &&
      investment.bankAccount &&
      (investment.principalAmount ?? 0) > 0
    ) {
      const expense = await ExpenseModel.create({
        user: userId,
        amount: investment.principalAmount ?? 0,
        category: "Investment",
        source: investment.institution || "Fixed Deposit",
        date: investment.startDate || investment.date,
        paymentMode: "Bank Transfer",
        bankAccount: investment.bankAccount,
        description: `Lumpsum Investment: ${investment.name || investment.type} at ${investment.institution}`,
      });

      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount: investment.bankAccount,
        type: "Debit",
        amount: investment.principalAmount ?? 0,
        description: `Lumpsum Investment: ${investment.name || investment.type} at ${investment.institution}`,
        date: investment.startDate || investment.date,
        source: "Expense",
        refId: expense._id,
      });

      investment.expenseRef = expense._id;
      await investment.save();
    }

    // Generate Recurring Contributions checklist
    if (investment.category === "Fixed-Tenure" && investment.investmentMode === "Recurring") {
      const tenureValue = Number(investment.tenureValue);
      const tenureUnit = investment.tenureUnit;
      const tenureInMonths = tenureUnit === "Years" ? tenureValue * 12 : tenureValue;
      const freq = investment.installmentFrequency || "Monthly";
      const totalInstallments = freq === "Quarterly" ? Math.round(tenureInMonths / 3) : tenureInMonths;
      const interval = freq === "Quarterly" ? 3 : 1;

      const contributions = [];
      const currentMonthStart = new Date();
      currentMonthStart.setDate(1);
      currentMonthStart.setHours(0, 0, 0, 0);

      for (let i = 0; i < totalInstallments; i++) {
        const dueDate = addMonths(new Date(investment.startDate!), i * interval);
        // Only generate contributions if they are due in the current month or in the future
        if (dueDate >= currentMonthStart) {
          contributions.push({
            user: userId,
            investment: investment._id,
            dueDate,
            amount: investment.installmentAmount || 0,
            status: "Pending",
          });
        }
      }
      if (contributions.length > 0) {
        await InvestmentContributionModel.insertMany(contributions);
      }
    }


    const countsMap = new Map();
    if (investment.category === "Fixed-Tenure" && investment.investmentMode === "Recurring") {
      const tenureValue = Number(investment.tenureValue);
      const tenureUnit = investment.tenureUnit;
      const tenureInMonths = tenureUnit === "Years" ? tenureValue * 12 : tenureValue;
      const freq = investment.installmentFrequency || "Monthly";
      const totalInstallments = freq === "Quarterly" ? Math.round(tenureInMonths / 3) : tenureInMonths;
      countsMap.set(investment._id.toString(), { total: totalInstallments, paid: 0 });
    }

    return NextResponse.json({ investment: serializeInvestment(investment, countsMap) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create investment." },
      { status: 400 }
    );
  }
}


