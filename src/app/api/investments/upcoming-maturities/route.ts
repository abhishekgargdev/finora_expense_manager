import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";
import { getUserId, serializeInvestment } from "@/lib/investments-api";

export async function GET(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const params = request.nextUrl.searchParams;
    const withinDays = Number(params.get("withinDays") ?? "30");

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const futureDate = new Date(today.getTime() + withinDays * 24 * 60 * 60 * 1000);
    futureDate.setHours(23, 59, 59, 999);

    // Fetch all Active, Fixed-Tenure investments maturing soon or already overdue
    const investments = await InvestmentModel.find({
      user: userId,
      category: "Fixed-Tenure",
      status: "Active",
      maturityDate: { $lte: futureDate },
    })
      .sort({ maturityDate: 1 })
      .lean();

    return NextResponse.json({
      investments: investments.map((item) => serializeInvestment(item)),
    });

  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load upcoming maturities." },
      { status: 500 }
    );
  }
}
