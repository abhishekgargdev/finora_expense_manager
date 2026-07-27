import { NextRequest, NextResponse } from "next/server";

import { getUserId, parseInvestment, serializeInvestment } from "../route";
import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";

async function getInvestment(id: string, userId: string) { const investment = await InvestmentModel.findOne({ _id: id, user: userId }); if (!investment) throw new Error("Investment not found."); return investment; }
async function updateInvestment(request: NextRequest, context: RouteContext<"/api/investments/[id]">) {
  try { await connect(); const userId = await getUserId(); const { id } = await context.params; const investment = await getInvestment(id, userId); Object.assign(investment, parseInvestment(await request.json(), true)); await investment.save(); return NextResponse.json({ investment: serializeInvestment(investment) }); }
  catch (error) { if (error instanceof Response) return error; const message = error instanceof Error ? error.message : "Unable to update investment."; return NextResponse.json({ error: message }, { status: message === "Investment not found." ? 404 : 400 }); }
}
export async function PUT(request: NextRequest, context: RouteContext<"/api/investments/[id]">) { return updateInvestment(request, context); }
export async function PATCH(request: NextRequest, context: RouteContext<"/api/investments/[id]">) { return updateInvestment(request, context); }
export async function DELETE(_: NextRequest, context: RouteContext<"/api/investments/[id]">) {
  try { await connect(); const userId = await getUserId(); const { id } = await context.params; const investment = await getInvestment(id, userId); await investment.deleteOne(); return NextResponse.json({ success: true }); }
  catch (error) { if (error instanceof Response) return error; const message = error instanceof Error ? error.message : "Unable to delete investment."; return NextResponse.json({ error: message }, { status: message === "Investment not found." ? 404 : 400 }); }
}
