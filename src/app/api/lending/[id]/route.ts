import { NextRequest, NextResponse } from "next/server";

import { ensureBankAccount, getUserId, parseLending, serializeLending } from "@/lib/lending-api";
import connect from "@/lib/db";
import BankTransactionModel from "@/models/BankTransaction";
import LendingModel from "@/models/Lending";

async function getLending(id: string, userId: string) {
  const lending = await LendingModel.findOne({ _id: id, user: userId });
  if (!lending) throw new Error("Lending record not found.");
  return lending;
}

async function updateLending(request: NextRequest, context: RouteContext<"/api/lending/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const lending = await getLending(id, userId);

    const input = parseLending(await request.json(), true);
    const bankAccount =
      input.bankAccount === undefined
        ? lending.bankAccount?.toString()
        : await ensureBankAccount(userId, input.bankAccount);

    const amount = typeof input.amount === "number" ? input.amount : lending.amount;
    const type = typeof input.type === "string" ? input.type : lending.type;
    const bankChanged =
      bankAccount !== lending.bankAccount?.toString() ||
      amount !== lending.amount ||
      type !== lending.type;

    if (bankChanged && lending.bankAccount) {
      // Offset old transaction
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount: lending.bankAccount.toString(),
        type: lending.type === "Given" ? "Credit" : "Debit",
        amount: lending.amount,
        description: `Lending edit offset: ${lending.type === "Given" ? "Lent to" : "Borrowed from"} ${lending.person}`,
        source: "Lending",
        refId: lending._id,
      });
    }

    Object.assign(lending, input, { bankAccount });
    if (lending.amountReturned > lending.amount) {
      throw new Error("Returned amount cannot exceed the original amount.");
    }
    await lending.save();

    if (bankChanged && bankAccount) {
      // Record new transaction
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount,
        type: lending.type === "Given" ? "Debit" : "Credit",
        amount: lending.amount,
        date: lending.date,
        description: `${lending.type === "Given" ? "Lent to" : "Borrowed from"} ${lending.person}${lending.note ? ` · ${lending.note}` : ""}`,
        source: "Lending",
        refId: lending._id,
      });
    }

    return NextResponse.json({ lending: serializeLending(lending) });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unable to update lending record.";
    return NextResponse.json({ error: message }, { status: message === "Lending record not found." ? 404 : 400 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext<"/api/lending/[id]">) {
  return updateLending(request, context);
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/lending/[id]">) {
  return updateLending(request, context);
}

export async function DELETE(_: NextRequest, context: RouteContext<"/api/lending/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const lending = await getLending(id, userId);

    // Offset initial lending/borrowing transaction
    if (lending.bankAccount) {
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount: lending.bankAccount.toString(),
        type: lending.type === "Given" ? "Credit" : "Debit",
        amount: lending.amount,
        description: `Lending deletion offset: ${lending.type === "Given" ? "Lent to" : "Borrowed from"} ${lending.person}`,
        source: "Lending",
        refId: lending._id,
      });
    }

    // Offset all repayments
    if (lending.repayments && lending.repayments.length > 0) {
      for (const rep of lending.repayments) {
        if (rep.bankAccount) {
          await BankTransactionModel.recordTransaction({
            user: userId,
            bankAccount: rep.bankAccount.toString(),
            type: lending.type === "Given" ? "Debit" : "Credit",
            amount: rep.amount,
            description: `Repayment deletion offset: ${lending.type === "Given" ? "Lending repayment received from" : "Lending repayment to"} ${lending.person}`,
            source: "Lending",
            refId: lending._id,
          });
        }
      }
    }

    await lending.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    const message = error instanceof Error ? error.message : "Unable to delete lending record.";
    return NextResponse.json({ error: message }, { status: message === "Lending record not found." ? 404 : 400 });
  }
}
