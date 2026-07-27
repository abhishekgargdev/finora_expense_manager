import { NextRequest, NextResponse } from "next/server";

import { getUserId, parseCard, serializeCard } from "@/lib/credit-cards-api";
import connect from "@/lib/db";
import CreditCardBillModel from "@/models/CreditCardBill";
import CreditCardModel from "@/models/CreditCard";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";
async function getCard(id: string, userId: string) {
  const card = await CreditCardModel.findOne({ _id: id, user: userId });
  if (!card) throw new Error("Credit card not found.");
  return card;
}
async function outstanding(card: { _id: unknown; user: unknown }) {
  const [current, bills] = await Promise.all([
    CreditCardTransactionModel.aggregate([
      { $match: { user: card.user, creditCard: card._id, billed: false } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    CreditCardBillModel.aggregate([
      { $match: { user: card.user, creditCard: card._id, isPaid: false } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } },
    ]),
  ]);
  return (current[0]?.total ?? 0) + (bills[0]?.total ?? 0);
}
export async function GET(_: NextRequest, context: RouteContext<"/api/credit-cards/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const card = await getCard(id, userId);
    return NextResponse.json({ card: serializeCard(card, await outstanding(card)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load card.";
    return NextResponse.json({ error: message }, { status: message === "Credit card not found." ? 404 : 400 });
  }
}
async function update(request: NextRequest, context: RouteContext<"/api/credit-cards/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const card = await getCard(id, userId);
    Object.assign(card, parseCard(await request.json(), true));
    await card.save();
    return NextResponse.json({ card: serializeCard(card, await outstanding(card)) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update card.";
    return NextResponse.json({ error: message }, { status: message === "Credit card not found." ? 404 : 400 });
  }
}
export async function PATCH(request: NextRequest, context: RouteContext<"/api/credit-cards/[id]">) {
  return update(request, context);
}
export async function PUT(request: NextRequest, context: RouteContext<"/api/credit-cards/[id]">) {
  return update(request, context);
}
export async function DELETE(_: NextRequest, context: RouteContext<"/api/credit-cards/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const card = await getCard(id, userId);
    await Promise.all([
      CreditCardTransactionModel.deleteMany({ user: userId, creditCard: card._id }),
      CreditCardBillModel.deleteMany({ user: userId, creditCard: card._id }),
    ]);
    await card.deleteOne();
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete card.";
    return NextResponse.json({ error: message }, { status: message === "Credit card not found." ? 404 : 400 });
  }
}
