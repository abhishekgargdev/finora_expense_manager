import { NextRequest, NextResponse } from "next/server";
import { getUserId, parseAccount, serializeAccount } from "@/lib/bank-accounts-api";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
async function getAccount(id: string, userId: string) {
  const account = await BankAccountModel.findOne({ _id: id, user: userId });
  if (!account) throw new Error("Bank account not found.");
  return account;
}
export async function GET(_: NextRequest, context: RouteContext<"/api/bank-accounts/[id]">) {
  try {
    await connect();
    const { id } = await context.params;
    return NextResponse.json({ account: serializeAccount(await getAccount(id, await getUserId())) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load bank account.";
    return NextResponse.json({ error: message }, { status: message === "Bank account not found." ? 404 : 400 });
  }
}
async function update(request: NextRequest, context: RouteContext<"/api/bank-accounts/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const account = await getAccount(id, userId);
    const body = await request.json();
    Object.assign(account, parseAccount(body, true));
    const corrected = body.currentBalance === undefined ? undefined : Number(body.currentBalance);
    if (corrected !== undefined && !Number.isFinite(corrected)) throw new Error("Corrected balance must be valid.");
    if (corrected !== undefined && corrected !== account.currentBalance) {
      const difference = corrected - account.currentBalance;
      await account.save();
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount: account._id,
        type: difference >= 0 ? "Credit" : "Debit",
        amount: Math.abs(difference),
        description: "Balance adjustment",
        source: "Manual",
      });
    } else await account.save();
    return NextResponse.json({ account: serializeAccount(await getAccount(id, userId)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update bank account.";
    return NextResponse.json({ error: message }, { status: message === "Bank account not found." ? 404 : 400 });
  }
}
export async function PATCH(request: NextRequest, context: RouteContext<"/api/bank-accounts/[id]">) {
  return update(request, context);
}
export async function PUT(request: NextRequest, context: RouteContext<"/api/bank-accounts/[id]">) {
  return update(request, context);
}
export async function DELETE(_: NextRequest, context: RouteContext<"/api/bank-accounts/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    await (await getAccount(id, userId)).deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete bank account.";
    return NextResponse.json({ error: message }, { status: message === "Bank account not found." ? 404 : 400 });
  }
}
