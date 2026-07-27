import { NextRequest, NextResponse } from "next/server";

import connect from "@/lib/db";
import CreditCardBillModel from "@/models/CreditCardBill";
import CreditCardModel from "@/models/CreditCard";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";

import { getUserId, parseCard, serializeCard } from "@/lib/credit-cards-api";

export async function GET() { try { await connect(); const userId = await getUserId(); const [cards, currentCycle, unpaidBills] = await Promise.all([CreditCardModel.find({ user: userId }).sort({ createdAt: -1 }).lean(), CreditCardTransactionModel.aggregate([{ $match: { user: (await import("mongoose")).default.Types.ObjectId.createFromHexString(userId), billed: false } }, { $group: { _id: "$creditCard", total: { $sum: "$amount" } } }]), CreditCardBillModel.aggregate([{ $match: { user: (await import("mongoose")).default.Types.ObjectId.createFromHexString(userId), isPaid: false } }, { $group: { _id: "$creditCard", total: { $sum: "$totalAmount" } } }])]); const outstanding = new Map<string, number>(); [...currentCycle, ...unpaidBills].forEach((item) => outstanding.set(item._id.toString(), (outstanding.get(item._id.toString()) ?? 0) + item.total)); return NextResponse.json({ cards: cards.map((card) => serializeCard(card, outstanding.get(card._id.toString()) ?? 0)) }); } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load credit cards." }, { status: 500 }); } }
export async function POST(request: NextRequest) { try { await connect(); const userId = await getUserId(); const card = await CreditCardModel.create({ ...parseCard(await request.json()), user: userId }); return NextResponse.json({ card: serializeCard(card) }, { status: 201 }); } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create credit card." }, { status: 400 }); } }
