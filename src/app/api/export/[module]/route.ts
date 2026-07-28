import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAuth } from "@/lib/auth";
import connect from "@/lib/db";
import BankAccountModel from "@/models/BankAccount";
import BankTransactionModel from "@/models/BankTransaction";
import ExpenseModel from "@/models/Expense";
import IncomeModel from "@/models/Income";
import InvestmentModel from "@/models/Investment";
import LendingModel from "@/models/Lending";
import CashTransactionModel from "@/models/CashTransaction";
const sheet = (rows: unknown[]) => XLSX.utils.aoa_to_sheet(rows as (string | number | Date | boolean | null)[][]);
export async function GET(request: NextRequest, context: RouteContext<"/api/export/[module]">) {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");
    const { module } = await context.params;
    const params = request.nextUrl.searchParams;
    const dates =
      params.get("from") || params.get("to")
        ? {
            $gte: params.get("from") ? new Date(params.get("from")!) : new Date(0),
            $lte: params.get("to") ? new Date(`${params.get("to")}T23:59:59.999Z`) : new Date("9999-12-31"),
          }
        : undefined;
    const query = { user: session.userId, ...(dates ? { date: dates } : {}) };
    const models: Record<string, { name: string; rows: () => Promise<unknown[]> }> = {
      income: { name: "Income", rows: () => IncomeModel.find(query).lean() },
      expense: { name: "Expense", rows: () => ExpenseModel.find(query).lean() },
      investment: { name: "Investment", rows: () => InvestmentModel.find(query).lean() },
      lending: { name: "Lending", rows: () => LendingModel.find(query).lean() },
      "bank-transactions": { name: "Bank Transactions", rows: () => BankTransactionModel.find(query).lean() },
      "bank-accounts": { name: "Bank Accounts", rows: () => BankAccountModel.find({ user: session.userId }).lean() },
      "cash-transactions": { name: "Cash Transactions", rows: () => CashTransactionModel.find(query).lean() },
    };
    if (!models[module]) return NextResponse.json({ error: "Unsupported export module." }, { status: 404 });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(await models[module].rows()), models[module].name);
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
    return new NextResponse(output, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${module}.xlsx"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed." }, { status: 400 });
  }
}
