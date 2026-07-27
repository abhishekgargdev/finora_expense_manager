import { NextRequest, NextResponse } from "next/server";

import { ensureBankAccount, getUserId, serializeLending } from "@/lib/lending-api";
import connect from "@/lib/db";
import BankTransactionModel from "@/models/BankTransaction";
import LendingModel from "@/models/Lending";

export async function POST(request: NextRequest, context: RouteContext<"/api/lending/[id]/repayment">) {
  try {
    await connect(); const userId = await getUserId(); const { id } = await context.params; const body = await request.json(); const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Repayment amount must be greater than zero.");
    const lending = await LendingModel.findOne({ _id: id, user: userId }); if (!lending) return NextResponse.json({ error: "Lending record not found." }, { status: 404 });
    if (lending.amountReturned + amount > lending.amount) throw new Error("Repayment cannot exceed the pending amount.");
    const bankAccount = await ensureBankAccount(userId, body.bankAccount); const repaymentDate = body.date ? new Date(String(body.date)) : new Date(); if (Number.isNaN(repaymentDate.getTime())) throw new Error("A valid repayment date is required.");
    lending.amountReturned += amount; await lending.save();
    if (bankAccount) await BankTransactionModel.recordTransaction({ user: userId, bankAccount, type: lending.type === "Given" ? "Credit" : "Debit", amount, date: repaymentDate, description: `${lending.type === "Given" ? "Lending repayment received from" : "Lending repayment to"} ${lending.person}`, source: "Lending", refId: lending._id });
    return NextResponse.json({ lending: serializeLending(lending) });
  } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record repayment." }, { status: 400 }); }
}
