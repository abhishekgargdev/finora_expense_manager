import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";
import InvestmentContributionModel from "@/models/InvestmentContribution";
import ExpenseModel from "@/models/Expense";
import BankTransactionModel from "@/models/BankTransaction";
import { getUserId } from "@/lib/investments-api";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;


    const contributions = await InvestmentContributionModel.find({
      investment: id,
      user: userId,
    })
      .sort({ dueDate: 1 })
      .lean();

    return NextResponse.json({
      contributions: contributions.map((c) => ({
        id: c._id.toString(),
        investment: c.investment.toString(),
        dueDate: c.dueDate.toISOString(),
        paidDate: c.paidDate ? c.paidDate.toISOString() : null,
        amount: c.amount,
        status: c.status,
        bankAccount: c.bankAccount?.toString() || null,
        expenseRef: c.expenseRef?.toString() || null,
        note: c.note,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load contributions." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;

    const investment = await InvestmentModel.findOne({ _id: id, user: userId });
    if (!investment) {
      return NextResponse.json({ error: "Investment not found." }, { status: 404 });
    }

    const body = await request.json();
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Amount must be positive.");
    }
    const bankAccount = body.bankAccount || null;
    const date = body.date ? new Date(body.date) : new Date();
    const note = body.note ? body.note.trim() : "Boost contribution";

    let expenseRef = null;

    if (bankAccount) {
      // 1. Create an Expense entry
      const expense = await ExpenseModel.create({
        user: userId,
        amount: amount,
        category: "Investment",
        source: investment.institution || "Investment Boost",
        date: date,
        paymentMode: "Bank Transfer",
        bankAccount,
        description: `Boost: ${investment.name || investment.type} at ${investment.institution || ""}${body.note ? ` · ${body.note}` : ""}`,
      });

      // 2. Record Debit BankTransaction
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount,
        type: "Debit",
        amount: amount,
        description: `Boost: ${investment.name || investment.type} at ${investment.institution || ""}${body.note ? ` · ${body.note}` : ""}`,
        date: date,
        source: "Expense",
        refId: expense._id,
      });

      expenseRef = expense._id;
    }

    // 3. Create a contribution record with status: "Paid"
    const contribution = await InvestmentContributionModel.create({
      user: userId,
      investment: id,
      dueDate: date,
      paidDate: date,
      amount,
      status: "Paid",
      bankAccount,
      expenseRef,
      note,
    });

    // 4. Update parent Investment amountInvested and currentValue
    investment.amountInvested = (investment.amountInvested || 0) + amount;
    investment.currentValue = (investment.currentValue || 0) + amount;
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
      }
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create boost contribution." },
      { status: 400 }
    );
  }
}

