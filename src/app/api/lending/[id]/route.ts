import { NextRequest, NextResponse } from "next/server";

import { getUserId, parseLending, serializeLending } from "@/lib/lending-api";
import connect from "@/lib/db";
import LendingModel from "@/models/Lending";

async function getLending(id: string, userId: string) { const lending = await LendingModel.findOne({ _id: id, user: userId }); if (!lending) throw new Error("Lending record not found."); return lending; }
async function updateLending(request: NextRequest, context: RouteContext<"/api/lending/[id]">) {
  try { await connect(); const userId = await getUserId(); const { id } = await context.params; const lending = await getLending(id, userId); Object.assign(lending, parseLending(await request.json(), true)); if (lending.amountReturned > lending.amount) throw new Error("Returned amount cannot exceed the original amount."); await lending.save(); return NextResponse.json({ lending: serializeLending(lending) }); }
  catch (error) { if (error instanceof Response) return error; const message = error instanceof Error ? error.message : "Unable to update lending record."; return NextResponse.json({ error: message }, { status: message === "Lending record not found." ? 404 : 400 }); }
}
export async function PUT(request: NextRequest, context: RouteContext<"/api/lending/[id]">) { return updateLending(request, context); }
export async function PATCH(request: NextRequest, context: RouteContext<"/api/lending/[id]">) { return updateLending(request, context); }
export async function DELETE(_: NextRequest, context: RouteContext<"/api/lending/[id]">) {
  try { await connect(); const userId = await getUserId(); const { id } = await context.params; const lending = await getLending(id, userId); await lending.deleteOne(); return NextResponse.json({ success: true }); }
  catch (error) { if (error instanceof Response) return error; const message = error instanceof Error ? error.message : "Unable to delete lending record."; return NextResponse.json({ error: message }, { status: message === "Lending record not found." ? 404 : 400 }); }
}
