import { NextRequest, NextResponse } from "next/server";

import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";
import { getUserId, parseInvestment, serializeInvestment } from "@/lib/investments-api";

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
    if (type) query.type = type;
    const sorts: Record<string, Record<string, 1 | -1>> = {
      newest: { date: -1 },
      oldest: { date: 1 },
      amount_asc: { amountInvested: 1 },
      amount_desc: { amountInvested: -1 },
    };
    const investments = await InvestmentModel.find(query)
      .sort(sorts[params.get("sort") ?? "newest"] ?? sorts.newest)
      .lean();
    return NextResponse.json({ investments: investments.map(serializeInvestment) });
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
    const investment = await InvestmentModel.create({ ...parseInvestment(await request.json()), user: userId });
    return NextResponse.json({ investment: serializeInvestment(investment) }, { status: 201 });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create investment." },
      { status: 400 }
    );
  }
}
