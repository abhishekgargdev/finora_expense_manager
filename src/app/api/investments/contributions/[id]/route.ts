import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";
import InvestmentContributionModel from "@/models/InvestmentContribution";
import ExpenseModel from "@/models/Expense";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import { getUserId } from "@/lib/investments-api";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;


    const contribution = await InvestmentContributionModel.findOne({ _id: id, user: userId });
    if (!contribution) {
      return NextResponse.json({ error: "Contribution installment not found." }, { status: 404 });
    }

    const oldStatus = contribution.status;
    const oldAmount = contribution.amount;

    const investment = await InvestmentModel.findOne({ _id: contribution.investment, user: userId });
    if (!investment) {
      return NextResponse.json({ error: "Associated investment not found." }, { status: 404 });
    }

    const body = await request.json();

    // 1. If previously Paid with an expense reference, revert the debit and delete the expense/transactions
    if (contribution.status === "Paid" && contribution.expenseRef) {
      const oldExpense = await ExpenseModel.findById(contribution.expenseRef);
      if (oldExpense && oldExpense.bankAccount) {
        // Revert bank balance
        await BankAccountModel.findByIdAndUpdate(oldExpense.bankAccount, {
          $inc: { currentBalance: oldExpense.amount },
        });
        // Delete debit transaction
        await BankTransactionModel.deleteMany({ refId: oldExpense._id, user: userId });
      }
      await ExpenseModel.deleteOne({ _id: contribution.expenseRef, user: userId });
      
      contribution.expenseRef = undefined;
      contribution.bankAccount = undefined;
      contribution.paidDate = undefined;
    }

    // 2. Perform the update
    const newStatus = body.status ?? contribution.status;
    const newAmount = body.amount !== undefined ? Number(body.amount) : contribution.amount;

    if (newStatus === "Paid") {
      const paidDate = body.paidDate ? new Date(body.paidDate) : new Date();
      const bankAccount = body.bankAccount || null;

      contribution.paidDate = paidDate;
      contribution.bankAccount = bankAccount;

      // Log Expense and record Debit BankTransaction if bankAccount is provided
      if (bankAccount) {
        const expense = await ExpenseModel.create({
          user: userId,
          amount: newAmount,
          category: "Investment",
          source: investment.institution || "Recurring Deposit",
          date: paidDate,
          paymentMode: "Bank Transfer",
          bankAccount,
          description: `RD Installment: ${investment.name || investment.type} at ${investment.institution}`,
        });

        await BankTransactionModel.recordTransaction({
          user: userId,
          bankAccount,
          type: "Debit",
          amount: newAmount,
          description: `RD Installment: ${investment.name || investment.type} at ${investment.institution}`,
          date: paidDate,
          source: "Expense",
          refId: expense._id,
        });

        contribution.expenseRef = expense._id;
      }
    } else {
      // Pending or Missed
      contribution.paidDate = null;
      contribution.bankAccount = null;
      contribution.expenseRef = null;
    }

    contribution.status = newStatus;
    contribution.amount = newAmount;
    if (body.dueDate !== undefined) contribution.dueDate = new Date(body.dueDate);
    if (body.note !== undefined) contribution.note = body.note || undefined;

    await contribution.save();

    // 3. Recalculate parent Investment amountInvested and currentValue
    const paidContributions = await InvestmentContributionModel.find({
      investment: investment._id,
      status: "Paid",
      user: userId,
    });
    const totalPaid = paidContributions.reduce((sum, c) => sum + c.amount, 0);
    investment.amountInvested = totalPaid;
    if (investment.status === "Active") {
      let currentValueAdjustment = 0;
      if (oldStatus === "Paid" && newStatus !== "Paid") {
        currentValueAdjustment = -oldAmount;
      } else if (oldStatus !== "Paid" && newStatus === "Paid") {
        currentValueAdjustment = newAmount;
      } else if (oldStatus === "Paid" && newStatus === "Paid") {
        currentValueAdjustment = newAmount - oldAmount;
      }
      investment.currentValue = Math.max(0, (investment.currentValue || 0) + currentValueAdjustment);
    }
    await investment.save();

    return NextResponse.json({
      success: true,
      contribution: {
        id: contribution._id.toString(),
        dueDate: contribution.dueDate.toISOString(),
        paidDate: contribution.paidDate ? contribution.paidDate.toISOString() : null,
        amount: contribution.amount,
        status: contribution.status,
        bankAccount: contribution.bankAccount?.toString() || null,
        expenseRef: contribution.expenseRef?.toString() || null,
        note: contribution.note,
      },
      investment: {
        id: investment._id.toString(),
        amountInvested: investment.amountInvested,
        currentValue: investment.currentValue,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update contribution installment." },
      { status: 400 }
    );
  }
}
