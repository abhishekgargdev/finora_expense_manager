import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/credit-cards-api";
import connect from "@/lib/db";
import CreditCardModel from "@/models/CreditCard";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";

async function getOutstanding(userId: string, cardId: string) {
  const mongoose = (await import("mongoose")).default;
  const cardObjectId = mongoose.Types.ObjectId.createFromHexString(cardId);
  const [currentCycle, unpaidBills] = await Promise.all([
    CreditCardTransactionModel.aggregate([
      { $match: { user: mongoose.Types.ObjectId.createFromHexString(userId), creditCard: cardObjectId, billed: false } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    (await import("@/models/CreditCardBill")).default.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId.createFromHexString(userId),
          creditCard: cardObjectId,
          isPaid: false,
        },
      },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);
  return (currentCycle[0]?.total ?? 0) + (unpaidBills[0]?.total ?? 0);
}

export async function GET(_: NextRequest, context: RouteContext<"/api/credit-cards/[id]/transactions">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    if (!(await CreditCardModel.exists({ _id: id, user: userId })))
      return NextResponse.json({ error: "Credit card not found." }, { status: 404 });
    const transactions = await CreditCardTransactionModel.find({ user: userId, creditCard: id })
      .sort({ date: -1 })
      .lean();
    return NextResponse.json({
      transactions: transactions.map((item) => ({
        id: item._id.toString(),
        amount: item.amount,
        description: item.description,
        date: item.date.toISOString(),
        billed: item.billed,
        billingMonth: item.billingMonth,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load transactions." },
      { status: 400 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext<"/api/credit-cards/[id]/transactions">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const card = await CreditCardModel.findOne({ _id: id, user: userId }).lean();
    if (!card) return NextResponse.json({ error: "Credit card not found." }, { status: 404 });

    const body = await request.json();
    const type = body.type === "Credit" || body.type === "Charge" ? body.type : "";
    const amount = Number(body.amount);
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const date = new Date(String(body.date));

    if (!type) throw new Error("Choose a transaction type.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
    if (!description) throw new Error("Description is required.");
    if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");

    const signedAmount = type === "Credit" ? -amount : amount;
    if (type === "Charge") {
      const outstanding = await getOutstanding(userId, id);
      if (outstanding + amount > card.creditLimit) {
        throw new Error("This charge would exceed the card's available credit.");
      }
    }

    const transaction = await CreditCardTransactionModel.create({
      user: userId,
      creditCard: id,
      amount: signedAmount,
      description,
      date,
      billed: false,
    });

    return NextResponse.json(
      {
        transaction: {
          id: transaction._id.toString(),
          amount: Math.abs(transaction.amount),
          type,
          description: transaction.description,
          date: transaction.date.toISOString(),
          billed: transaction.billed,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add transaction." },
      { status: 400 }
    );
  }
}
