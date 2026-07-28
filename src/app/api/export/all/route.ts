// @ts-nocheck
import { NextResponse } from "next/server";
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
export async function GET() {
  try {
    await connect();
    const session = await requireAuth();
    if (typeof session.userId !== "string") throw new Error("Unauthorized");
    const user = { user: session.userId };
    const [income, expenses, investments, lending, accounts, transactions, cashTransactions] = await Promise.all([
      IncomeModel.find(user).lean(),
      ExpenseModel.find(user).lean(),
      InvestmentModel.find(user).lean(),
      LendingModel.find(user).lean(),
      BankAccountModel.find(user).lean(),
      BankTransactionModel.find(user).lean(),
      CashTransactionModel.find(user).lean(),
    ]);
    const workbook = XLSX.utils.book_new();
    [
      ["Income", income],
      ["Expenses", expenses],
      ["Investments", investments],
      ["Lending", lending],
      ["Bank Accounts", accounts],
      ["Bank Transactions", transactions],
      ["Cash Transactions", cashTransactions],
    ].forEach(([name, rows]) =>
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows as object[]), name)
    );
    return new NextResponse(XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=finance-tracker-export.xlsx",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Export failed." }, { status: 400 });
  }
}
