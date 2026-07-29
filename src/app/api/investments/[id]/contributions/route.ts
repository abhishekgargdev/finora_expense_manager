import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import InvestmentContributionModel from "@/models/InvestmentContribution";
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
