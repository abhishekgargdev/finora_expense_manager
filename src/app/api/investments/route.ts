import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import InvestmentModel from "@/models/Investment";

const TYPES = ["Mutual Fund", "Stocks", "FD", "RD", "Gold", "Crypto", "PPF", "Other"] as const;
type InvestmentInput = { type?: unknown; name?: unknown; amountInvested?: unknown; currentValue?: unknown; date?: unknown; note?: unknown };
export type InvestmentRecord = { id: string; type: string; name?: string; amountInvested: number; currentValue: number; date: string; note?: string };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
export function parseInvestment(input: InvestmentInput, partial = false) {
  const values: Record<string, unknown> = {};
  if (!partial || input.type !== undefined) { const type = text(input.type); if (!TYPES.includes(type as (typeof TYPES)[number])) throw new Error("Choose a valid investment type."); values.type = type; }
  for (const key of ["amountInvested", "currentValue"] as const) if (!partial || input[key] !== undefined) { const value = Number(input[key]); if (!Number.isFinite(value) || value < 0 || (key === "amountInvested" && value === 0)) throw new Error(`${key === "amountInvested" ? "Amount invested" : "Current value"} must be valid.`); values[key] = value; }
  if (!partial || input.date !== undefined) { const date = new Date(text(input.date)); if (Number.isNaN(date.getTime())) throw new Error("A valid date is required."); values.date = date; }
  if (input.name !== undefined || !partial) values.name = text(input.name) || undefined;
  if (input.note !== undefined || !partial) values.note = text(input.note) || undefined;
  return values;
}
export function serializeInvestment(item: { _id: { toString(): string }; type: string; name?: string; amountInvested: number; currentValue?: number; date: Date; note?: string }): InvestmentRecord { return { id: item._id.toString(), type: item.type, name: item.name, amountInvested: item.amountInvested, currentValue: item.currentValue ?? item.amountInvested, date: item.date.toISOString(), note: item.note }; }
export async function getUserId() { const session = await requireAuth(); if (typeof session.userId !== "string") throw new Error("Unauthorized"); return session.userId; }

export async function GET(request: NextRequest) {
  try {
    await connect(); const userId = await getUserId(); const params = request.nextUrl.searchParams; const query: Record<string, unknown> = { user: userId };
    const year = Number(params.get("year")); const month = Number(params.get("month"));
    if (Number.isInteger(year) && year >= 2000 && year <= 2200) { const hasMonth = Number.isInteger(month) && month >= 1 && month <= 12; const start = hasMonth ? month - 1 : 0; query.date = { $gte: new Date(Date.UTC(year, start, 1)), $lt: new Date(Date.UTC(year, hasMonth ? start + 1 : 12, 1)) }; }
    const type = text(params.get("type") ?? params.get("category")); if (type) query.type = type;
    const sorts: Record<string, Record<string, 1 | -1>> = { newest: { date: -1 }, oldest: { date: 1 }, amount_asc: { amountInvested: 1 }, amount_desc: { amountInvested: -1 } };
    const investments = await InvestmentModel.find(query).sort(sorts[params.get("sort") ?? "newest"] ?? sorts.newest).lean();
    return NextResponse.json({ investments: investments.map(serializeInvestment) });
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load investments." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try { await connect(); const userId = await getUserId(); const investment = await InvestmentModel.create({ ...parseInvestment(await request.json()), user: userId }); return NextResponse.json({ investment: serializeInvestment(investment) }, { status: 201 }); }
  catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create investment." }, { status: 400 }); }
}
