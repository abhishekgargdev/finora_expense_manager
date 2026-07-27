import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/credit-cards-api";
import { serializeBill } from "@/lib/credit-card-bills";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import CreditCardBillModel from "@/models/CreditCardBill";
export async function POST(request: NextRequest, context: RouteContext<"/api/credit-cards/[id]/bills/[billId]/pay">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id, billId } = await context.params;
    const bill = await CreditCardBillModel.findOne({ _id: billId, creditCard: id, user: userId });
    if (!bill) return NextResponse.json({ error: "Bill not found." }, { status: 404 });
    if (bill.isPaid) throw new Error("This bill has already been paid.");
    const body = await request.json().catch(() => ({}));
    const bankAccount = typeof body.bankAccount === "string" ? body.bankAccount : "";
    if (bankAccount && !(await BankAccountModel.exists({ _id: bankAccount, user: userId })))
      throw new Error("The selected bank account was not found.");
    const paidAmount = body.paidAmount === undefined ? bill.totalAmount : Number(body.paidAmount);
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) throw new Error("Paid amount must be greater than zero.");
    const paidDate = body.paidDate ? new Date(String(body.paidDate)) : new Date();
    if (Number.isNaN(paidDate.getTime())) throw new Error("A valid payment date is required.");
    bill.isPaid = true;
    bill.paidAmount = paidAmount;
    bill.paidDate = paidDate;
    await bill.save();
    if (bankAccount)
      await BankTransactionModel.recordTransaction({
        user: userId,
        bankAccount,
        type: "Debit",
        amount: paidAmount,
        description: `Credit card bill: ${bill.billingMonth}`,
        date: paidDate,
        source: "Transfer",
        refId: bill._id,
      });
    return NextResponse.json({ bill: serializeBill(bill) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to mark bill as paid." },
      { status: 400 }
    );
  }
}
