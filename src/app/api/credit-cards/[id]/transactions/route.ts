import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/credit-cards-api";
import connect from "@/lib/db";
import CreditCardModel from "@/models/CreditCard";
import CreditCardTransactionModel from "@/models/CreditCardTransaction";
export async function GET(_: NextRequest, context: RouteContext<"/api/credit-cards/[id]/transactions">) { try { await connect(); const userId = await getUserId(); const { id } = await context.params; if (!await CreditCardModel.exists({ _id: id, user: userId })) return NextResponse.json({ error: "Credit card not found." }, { status: 404 }); const transactions = await CreditCardTransactionModel.find({ user: userId, creditCard: id }).sort({ date: -1 }).lean(); return NextResponse.json({ transactions: transactions.map((item) => ({ id: item._id.toString(), amount: item.amount, description: item.description, date: item.date.toISOString(), billed: item.billed, billingMonth: item.billingMonth })) }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load transactions." }, { status: 400 }); } }
