import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import LendingModel from "@/models/Lending";

const TYPES = ["Given", "Taken"] as const;
type LendingInput = { person?: unknown; type?: unknown; amount?: unknown; date?: unknown; dueDate?: unknown; note?: unknown; amountReturned?: unknown };
export type LendingRecord = { id: string; person: string; type: "Given" | "Taken"; amount: number; amountReturned: number; status: "Pending" | "Partially Returned" | "Settled"; date: string; dueDate?: string | null; note?: string };

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function dateValue(value: unknown, label: string, required = true) { const raw = text(value); if (!raw && !required) return null; const date = new Date(raw); if (!raw || Number.isNaN(date.getTime())) throw new Error(`A valid ${label} is required.`); return date; }

export function parseLending(input: LendingInput, partial = false) {
  const values: Record<string, unknown> = {};
  if (!partial || input.person !== undefined) { const person = text(input.person); if (!person) throw new Error("Person is required."); values.person = person; }
  if (!partial || input.type !== undefined) { const type = text(input.type); if (!TYPES.includes(type as (typeof TYPES)[number])) throw new Error("Choose whether the money was given or taken."); values.type = type; }
  if (!partial || input.amount !== undefined) { const amount = Number(input.amount); if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero."); values.amount = amount; }
  if (!partial || input.date !== undefined) values.date = dateValue(input.date, "date");
  if (input.dueDate !== undefined || !partial) values.dueDate = dateValue(input.dueDate, "due date", false);
  if (input.note !== undefined || !partial) values.note = text(input.note) || undefined;
  if (input.amountReturned !== undefined) { const amountReturned = Number(input.amountReturned); if (!Number.isFinite(amountReturned) || amountReturned < 0) throw new Error("Returned amount must be valid."); values.amountReturned = amountReturned; }
  return values;
}

export function serializeLending(item: { _id: { toString(): string }; person: string; type: "Given" | "Taken"; amount: number; amountReturned: number; status: LendingRecord["status"]; date: Date; dueDate?: Date | null; note?: string }): LendingRecord {
  return { id: item._id.toString(), person: item.person, type: item.type, amount: item.amount, amountReturned: item.amountReturned, status: item.status, date: item.date.toISOString(), dueDate: item.dueDate?.toISOString() ?? null, note: item.note };
}
export async function getUserId() { const session = await requireAuth(); if (typeof session.userId !== "string") throw new Error("Unauthorized"); return session.userId; }
export async function ensureBankAccount(userId: string, value?: unknown) { const id = text(value); if (!id) return undefined; if (!await BankAccountModel.exists({ _id: id, user: userId })) throw new Error("The selected bank account was not found."); return id; }

export async function GET(request: NextRequest) {
  try {
    await connect(); const userId = await getUserId(); const type = text(request.nextUrl.searchParams.get("type")); const query: Record<string, unknown> = { user: userId }; if (type) query.type = type;
    const [lending, bankAccounts] = await Promise.all([LendingModel.find(query).sort({ date: -1, createdAt: -1 }).lean(), BankAccountModel.find({ user: userId }).sort({ bankName: 1 }).select("bankName accountName last4Digits").lean()]);
    return NextResponse.json({ lending: lending.map(serializeLending), bankAccounts: bankAccounts.map((account) => ({ id: account._id.toString(), name: account.accountName || account.bankName, last4Digits: account.last4Digits })) });
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load lending records." }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try { await connect(); const userId = await getUserId(); const lending = await LendingModel.create({ ...parseLending(await request.json()), user: userId, amountReturned: 0 }); return NextResponse.json({ lending: serializeLending(lending) }, { status: 201 }); }
  catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create lending record." }, { status: 400 }); }
}
