import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import GroupModel from "@/models/Group";
import GroupExpenseModel from "@/models/GroupExpense";
import ExpenseModel from "@/models/Expense";
import LendingModel from "@/models/Lending";
import BankTransactionModel from "@/models/BankTransaction";
import CashTransactionModel from "@/models/CashTransaction";
import { getUserId } from "@/lib/bank-accounts-api";

// Suggested settlements algorithm
function calculateSettlements(members: string[], balances: Record<string, number>) {
  const creditors: { member: string; balance: number }[] = [];
  const debtors: { member: string; balance: number }[] = [];

  for (const m of members) {
    const bal = balances[m] || 0;
    if (bal > 0.01) {
      creditors.push({ member: m, balance: bal });
    } else if (bal < -0.01) {
      debtors.push({ member: m, balance: -bal }); // positive debt amount
    }
  }

  creditors.sort((a, b) => b.balance - a.balance);
  debtors.sort((a, b) => b.balance - a.balance);

  const settlements: { from: string; to: string; amount: number }[] = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];

    const amount = Math.min(creditor.balance, debtor.balance);
    settlements.push({
      from: debtor.member,
      to: creditor.member,
      amount: Number(amount.toFixed(2)),
    });

    creditor.balance -= amount;
    debtor.balance -= amount;

    if (creditor.balance < 0.01) cIdx++;
    if (debtor.balance < 0.01) dIdx++;
  }

  return settlements;
}

export async function GET(request: NextRequest, context: RouteContext<"/api/groups/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;

    const group = await GroupModel.findOne({ _id: id, user: userId }).lean();
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    const expenses = await GroupExpenseModel.find({ group: id })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Calculate balances for each member
    // Balance = PaidAmount - ShareAmount
    const balances: Record<string, number> = {};
    group.members.forEach((m) => {
      balances[m] = 0;
    });

    let totalSpending = 0;

    for (const exp of expenses) {
      const payer = exp.paidBy;
      
      // Initialize payer balance entry if missing
      if (balances[payer] === undefined) {
        balances[payer] = 0;
      }

      if (!exp.isSettlement) {
        totalSpending += exp.amount;
      }

      balances[payer] += exp.amount;

      for (const split of exp.splits) {
        if (balances[split.member] === undefined) {
          balances[split.member] = 0;
        }
        balances[split.member] -= split.amount;
      }
    }

    // Format balances to fixed 2 decimals
    const formattedBalances: Record<string, number> = {};
    Object.entries(balances).forEach(([m, bal]) => {
      formattedBalances[m] = Number(bal.toFixed(2));
    });

    const suggestedSettlements = calculateSettlements(group.members, { ...balances });

    return NextResponse.json({
      group: {
        id: group._id.toString(),
        name: group.name,
        description: group.description,
        members: group.members,
      },
      expenses: expenses.map((exp) => ({
        id: exp._id.toString(),
        description: exp.description,
        amount: exp.amount,
        paidBy: exp.paidBy,
        date: exp.date.toISOString(),
        isSettlement: exp.isSettlement,
        splits: exp.splits,
      })),
      balances: formattedBalances,
      suggestedSettlements,
      totalSpending,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load group details." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/groups/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;

    const group = await GroupModel.findOne({ _id: id, user: userId });
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    // Load group expenses
    const expenses = await GroupExpenseModel.find({ group: id, user: userId });

    for (const exp of expenses) {
      // 1. Delete and reverse main Expense entry
      if (exp.expenseRef) {
        const mainExp = await ExpenseModel.findOne({ _id: exp.expenseRef, user: userId });
        if (mainExp) {
          if (mainExp.bankAccount) {
            await BankTransactionModel.recordTransaction({
              user: userId,
              bankAccount: mainExp.bankAccount,
              type: "Credit",
              amount: mainExp.amount,
              description: `Expense removal (Group Delete): ${mainExp.source || mainExp.category}`,
              source: "Expense",
              refId: mainExp._id,
            });
          }
          if (mainExp.paymentMode === "Cash") {
            await CashTransactionModel.recordTransaction({
              user: userId,
              type: "Credit",
              amount: mainExp.amount,
              description: `Expense removal (Group Delete): ${mainExp.source || mainExp.category}`,
              source: "Expense",
              refId: mainExp._id,
            });
          }
          await mainExp.deleteOne();
        }
      }

      // 2. Delete main Lending entries and reverse their repayments (if any)
      if (exp.lendingRefs && exp.lendingRefs.length > 0) {
        for (const lendingId of exp.lendingRefs) {
          const lending = await LendingModel.findOne({ _id: lendingId, user: userId });
          if (lending) {
            // Reverse any repayments made
            if (lending.repayments && lending.repayments.length > 0) {
              for (const rep of lending.repayments) {
                if (rep.bankAccount) {
                  await BankTransactionModel.recordTransaction({
                    user: userId,
                    bankAccount: rep.bankAccount,
                    type: lending.type === "Given" ? "Debit" : "Credit",
                    amount: rep.amount,
                    description: `Repayment reversal (Group Delete): ${lending.person}`,
                    source: "Lending",
                    refId: lending._id,
                  });
                }
              }
            }
            await lending.deleteOne();
          }
        }
      }
    }

    // 3. Delete GroupExpense entries
    await GroupExpenseModel.deleteMany({ group: id, user: userId });

    // 4. Delete Group
    await group.deleteOne();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete group." },
      { status: 400 }
    );
  }
}
