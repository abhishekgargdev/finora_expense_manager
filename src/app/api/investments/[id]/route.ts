import { NextRequest, NextResponse } from "next/server";

import { getUserId, parseInvestment, serializeInvestment } from "@/lib/investments-api";
import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";
import InvestmentContributionModel from "@/models/InvestmentContribution";
import ExpenseModel from "@/models/Expense";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";

async function getInvestment(id: string, userId: string) {
  const investment = await InvestmentModel.findOne({ _id: id, user: userId });
  if (!investment) throw new Error("Investment not found.");
  return investment;
}

async function updateInvestment(request: NextRequest, context: RouteContext<"/api/investments/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const investment = await getInvestment(id, userId);

    const oldPrincipal = investment.principalAmount || 0;
    const oldBankAccount = investment.bankAccount?.toString();
    const oldExpenseRef = investment.expenseRef;

    const parsed = parseInvestment(await request.json(), true);

    // If status changes to Closed/Matured:
    if (parsed.status === "Matured" || parsed.status === "Closed Prematurely") {
      if (parsed.actualMaturityAmount === undefined || parsed.actualMaturityAmount < 0) {
        throw new Error("Actual maturity amount is required when closing an investment.");
      }
      if (!parsed.actualClosureDate) {
        throw new Error("Actual closure date is required when closing an investment.");
      }
      parsed.currentValue = parsed.actualMaturityAmount;
    }

    // Check if principal or bankAccount is changing for Lumpsum
    if (investment.category === "Fixed-Tenure" && investment.investmentMode === "Lumpsum") {
      const newPrincipal = parsed.principalAmount !== undefined ? parsed.principalAmount : oldPrincipal;
      const newBankAccount = parsed.bankAccount !== undefined ? parsed.bankAccount : oldBankAccount;

      const principalChanged = newPrincipal !== oldPrincipal;
      const bankChanged = newBankAccount !== oldBankAccount;

      if (principalChanged || bankChanged) {
        // Revert old expense and transaction if exists
        if (oldExpenseRef) {
          const oldExpense = await ExpenseModel.findById(oldExpenseRef);
          if (oldExpense && oldExpense.bankAccount) {
            // Add back the balance
            await BankAccountModel.findByIdAndUpdate(oldExpense.bankAccount, {
              $inc: { currentBalance: oldExpense.amount },
            });
            await BankTransactionModel.deleteMany({ refId: oldExpense._id, user: userId });
          }
          await ExpenseModel.deleteOne({ _id: oldExpenseRef, user: userId });
          investment.expenseRef = null;
        }

        // Create new expense and transaction if new bankAccount is selected
        if (newBankAccount && newPrincipal > 0) {
          const instName = parsed.institution !== undefined ? parsed.institution : investment.institution;
          const nameStr = parsed.name !== undefined ? parsed.name : investment.name;
          const sDate = parsed.startDate !== undefined ? parsed.startDate : investment.startDate;

          const expense = await ExpenseModel.create({
            user: userId,
            amount: newPrincipal,
            category: "Investment",
            source: instName || "Fixed Deposit",
            date: sDate || investment.date,
            paymentMode: "Bank Transfer",
            bankAccount: newBankAccount,
            description: `Lumpsum Investment: ${nameStr || investment.type} at ${instName}`,
          });

          await BankTransactionModel.recordTransaction({
            user: userId,
            bankAccount: newBankAccount,
            type: "Debit",
            amount: newPrincipal,
            description: `Lumpsum Investment: ${nameStr || investment.type} at ${instName}`,
            date: sDate || investment.date,
            source: "Expense",
            refId: expense._id,
          });

          parsed.expenseRef = expense._id;
        }
      }
    }

    Object.assign(investment, parsed);
    await investment.save();

    const contribCounts = await InvestmentContributionModel.aggregate([
      { $match: { investment: investment._id } },
      {
        $group: {
          _id: "$investment",
          total: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ["$status", "Paid"] }, 1, 0] } },
        },
      },
    ]);
    const countsMap = new Map(contribCounts.map((c) => [c._id.toString(), { total: c.total, paid: c.paid }]));

    return NextResponse.json({ investment: serializeInvestment(investment, countsMap) });
  } catch (error) {
    if (error instanceof Response) return error;

    const message = error instanceof Error ? error.message : "Unable to update investment.";
    return NextResponse.json({ error: message }, { status: message === "Investment not found." ? 404 : 400 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/investments/[id]">) {
  return updateInvestment(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/investments/[id]">) {
  return updateInvestment(request, context);
}

export async function DELETE(_: NextRequest, context: RouteContext<"/api/investments/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const investment = await getInvestment(id, userId);

    // Revert lumpsum expense if it exists
    if (investment.expenseRef) {
      const expense = await ExpenseModel.findById(investment.expenseRef);
      if (expense && expense.bankAccount) {
        // Revert bank balance
        await BankAccountModel.findByIdAndUpdate(expense.bankAccount, {
          $inc: { currentBalance: expense.amount },
        });
        // Delete associated bank transactions
        await BankTransactionModel.deleteMany({ refId: expense._id, user: userId });
      }
      await ExpenseModel.deleteOne({ _id: investment.expenseRef, user: userId });
    }

    // Revert and cascade delete all contributions
    const contributions = await InvestmentContributionModel.find({ investment: investment._id, user: userId });
    for (const c of contributions) {
      if (c.expenseRef) {
        const expense = await ExpenseModel.findById(c.expenseRef);
        if (expense && expense.bankAccount) {
          // Revert bank balance
          await BankAccountModel.findByIdAndUpdate(expense.bankAccount, {
            $inc: { currentBalance: expense.amount },
          });
          // Delete associated bank transactions
          await BankTransactionModel.deleteMany({ refId: expense._id, user: userId });
        }
        await ExpenseModel.deleteOne({ _id: c.expenseRef, user: userId });
      }
    }
    await InvestmentContributionModel.deleteMany({ investment: investment._id, user: userId });

    await investment.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unable to delete investment.";
    return NextResponse.json({ error: message }, { status: message === "Investment not found." ? 404 : 400 });
  }
}

