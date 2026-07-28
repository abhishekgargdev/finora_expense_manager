import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import GroupModel from "@/models/Group";
import GroupExpenseModel from "@/models/GroupExpense";
import ExpenseModel from "@/models/Expense";
import LendingModel from "@/models/Lending";
import BankTransactionModel from "@/models/BankTransaction";
import CashTransactionModel from "@/models/CashTransaction";
import { getUserId } from "@/lib/bank-accounts-api";

export async function POST(request: NextRequest, context: RouteContext<"/api/groups/[id]/expenses">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const body = await request.json();

    const {
      description: rawDescription,
      amount: rawAmount,
      paidBy: rawPaidBy,
      date: rawDate,
      splits: rawSplits,
      isSettlement = false,
      paymentMode,
      bankAccountId,
      creditCardId,
    } = body;

    const description = typeof rawDescription === "string" ? rawDescription.trim() : "";
    const amount = Number(rawAmount);
    const paidBy = typeof rawPaidBy === "string" ? rawPaidBy.trim() : "";
    const date = rawDate ? new Date(rawDate) : new Date();

    if (!description) throw new Error("Description is required.");
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
    if (!paidBy) throw new Error("Payer is required.");
    if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
    if (!Array.isArray(rawSplits) || rawSplits.length === 0) throw new Error("Splits are required.");

    const splits = rawSplits.map((s: any) => ({
      member: String(s.member).trim(),
      amount: Number(s.amount),
    }));

    // Find the group
    const group = await GroupModel.findOne({ _id: id, user: userId });
    if (!group) {
      return NextResponse.json({ error: "Group not found." }, { status: 404 });
    }

    // Initialize refs
    let expenseRef = null;
    const lendingRefs: any[] = [];

    if (!isSettlement) {
      // REGULAR EXPENSE split linking logic
      const userSplit = splits.find((s) => s.member.toLowerCase() === "you");
      const userShare = userSplit ? userSplit.amount : 0;

      // 1. Create personal Expense for the user's share (if any)
      if (userShare > 0) {
        // If user paid, we debit their bank/cash account
        // If someone else paid, we use "Bank Transfer" with null bankAccount (no immediate debit)
        const isUserPayer = paidBy.toLowerCase() === "you";
        const finalPaymentMode = isUserPayer ? (paymentMode || "UPI") : "Bank Transfer";
        const finalBankAccount = isUserPayer ? (bankAccountId || null) : null;
        const finalCreditCard = isUserPayer ? (creditCardId || null) : null;

        const mainExpense = await ExpenseModel.create({
          user: userId,
          amount: userShare,
          category: "Group Split",
          source: `${group.name}: ${description}`,
          date,
          paymentMode: finalPaymentMode,
          bankAccount: finalBankAccount,
          creditCard: finalCreditCard,
          note: `Group Expense inside ${group.name}. Total bill: ₹${amount} (Payer: ${paidBy})`,
        });

        expenseRef = mainExpense._id;

        // If user is payer and paid in Cash, record the Cash Debit
        if (isUserPayer && finalPaymentMode === "Cash") {
          await CashTransactionModel.recordTransaction({
            user: userId,
            type: "Debit",
            amount: userShare,
            description: `Expense: ${group.name}: ${description}`,
            date,
            source: "Expense",
            refId: mainExpense._id,
          });
        }
        // If user is payer and paid in Bank, the Expense POST middleware does NOT run because
        // we write to Mongoose model directly here. Let's record the BankTransaction debit!
        if (isUserPayer && finalBankAccount) {
          await BankTransactionModel.recordTransaction({
            user: userId,
            bankAccount: finalBankAccount,
            type: "Debit",
            amount: userShare,
            description: `Expense: ${group.name}: ${description}`,
            date,
            source: "Expense",
            refId: mainExpense._id,
          });
        }
      }

      // 2. Create Lending entries for splits
      const isUserPayer = paidBy.toLowerCase() === "you";

      if (isUserPayer) {
        // User paid the entire bill. Other members owe the user (Given entries)
        for (const split of splits) {
          if (split.member.toLowerCase() === "you") continue;

          const lending = await LendingModel.create({
            user: userId,
            person: split.member,
            type: "Given",
            amount: split.amount,
            amountReturned: 0,
            status: "Pending",
            date,
            note: `Split: ${group.name} - ${description}`,
            bankAccount: bankAccountId || undefined,
          });

          lendingRefs.push(lending._id);

          // Debit user's bank/cash for lending split
          if (paymentMode === "Cash") {
            await CashTransactionModel.recordTransaction({
              user: userId,
              type: "Debit",
              amount: split.amount,
              description: `Lent to ${split.member} (Split: ${description})`,
              date,
              source: "Lending",
              refId: lending._id,
            });
          } else if (bankAccountId) {
            await BankTransactionModel.recordTransaction({
              user: userId,
              bankAccount: bankAccountId,
              type: "Debit",
              amount: split.amount,
              description: `Lent to ${split.member} (Split: ${description})`,
              date,
              source: "Lending",
              refId: lending._id,
            });
          }
        }
      } else {
        // Someone else paid. User owes them (Taken entry)
        if (userShare > 0) {
          const lending = await LendingModel.create({
            user: userId,
            person: paidBy,
            type: "Taken",
            amount: userShare,
            amountReturned: 0,
            status: "Pending",
            date,
            note: `Split: ${group.name} - ${description}`,
          });

          lendingRefs.push(lending._id);
          // Note: No bank debit on Taken (borrowing) creation.
        }
      }
    } else {
      // SETTLEMENT split linking logic
      // User paying a member, or a member paying the user
      const isUserPayer = paidBy.toLowerCase() === "you";
      const receiver = splits[0]?.member || "";

      if (isUserPayer) {
        // User pays Rahul ₹200. This settles debt (Taken record).
        // Find unsettled Lending "Taken" record for Rahul
        const debt = await LendingModel.findOne({
          user: userId,
          person: receiver,
          type: "Taken",
          status: { $ne: "Settled" },
        }).sort({ date: 1 });

        let lendingId = null;
        if (debt) {
          debt.amountReturned = Math.min(debt.amount, debt.amountReturned + amount);
          if (!debt.repayments) debt.repayments = [];
          debt.repayments.push({
            amount,
            date,
            bankAccount: bankAccountId || undefined,
          });
          await debt.save();
          lendingId = debt._id;
        } else {
          // If no active debt is found, create a pre-settled Borrowed record to track history
          const newDebt = await LendingModel.create({
            user: userId,
            person: receiver,
            type: "Taken",
            amount,
            amountReturned: amount,
            status: "Settled",
            date,
            note: `Settle: Paid ${receiver} for ${group.name}`,
            bankAccount: bankAccountId || undefined,
            repayments: [{ amount, date, bankAccount: bankAccountId || undefined }],
          });
          lendingId = newDebt._id;
        }

        lendingRefs.push(lendingId);

        // Debit the bank/cash account
        if (paymentMode === "Cash") {
          await CashTransactionModel.recordTransaction({
            user: userId,
            type: "Debit",
            amount,
            description: `Paid ${receiver} (Group Settlement)`,
            date,
            source: "Lending",
            refId: lendingId,
          });
        } else if (bankAccountId) {
          await BankTransactionModel.recordTransaction({
            user: userId,
            bankAccount: bankAccountId,
            type: "Debit",
            amount,
            date,
            description: `Paid ${receiver} (Group Settlement)`,
            source: "Lending",
            refId: lendingId,
          });
        }
      } else {
        // Rahul pays User ₹200. This settles money Rahul owes (Given record).
        const splitUser = splits.find((s) => s.member.toLowerCase() === "you");
        const receiveAmount = splitUser ? splitUser.amount : amount;

        // Find unsettled Lending "Given" record for Rahul
        const loan = await LendingModel.findOne({
          user: userId,
          person: paidBy,
          type: "Given",
          status: { $ne: "Settled" },
        }).sort({ date: 1 });

        let lendingId = null;
        if (loan) {
          loan.amountReturned = Math.min(loan.amount, loan.amountReturned + receiveAmount);
          if (!loan.repayments) loan.repayments = [];
          loan.repayments.push({
            amount: receiveAmount,
            date,
            bankAccount: bankAccountId || undefined,
          });
          await loan.save();
          lendingId = loan._id;
        } else {
          const newLoan = await LendingModel.create({
            user: userId,
            person: paidBy,
            type: "Given",
            amount: receiveAmount,
            amountReturned: receiveAmount,
            status: "Settled",
            date,
            note: `Settle: Received from ${paidBy} for ${group.name}`,
            bankAccount: bankAccountId || undefined,
            repayments: [{ amount: receiveAmount, date, bankAccount: bankAccountId || undefined }],
          });
          lendingId = newLoan._id;
        }

        lendingRefs.push(lendingId);

        // Credit the bank/cash account
        if (paymentMode === "Cash") {
          await CashTransactionModel.recordTransaction({
            user: userId,
            type: "Credit",
            amount: receiveAmount,
            description: `Received from ${paidBy} (Group Settlement)`,
            date,
            source: "Lending",
            refId: lendingId,
          });
        } else if (bankAccountId) {
          await BankTransactionModel.recordTransaction({
            user: userId,
            bankAccount: bankAccountId,
            type: "Credit",
            amount: receiveAmount,
            date,
            description: `Received from ${paidBy} (Group Settlement)`,
            source: "Lending",
            refId: lendingId,
          });
        }
      }
    }

    // 3. Create GroupExpense record
    const groupExpense = await GroupExpenseModel.create({
      user: userId,
      group: id,
      description,
      amount,
      paidBy,
      date,
      splits,
      isSettlement,
      expenseRef,
      lendingRefs,
    });

    return NextResponse.json({
      expense: {
        id: groupExpense._id.toString(),
        description: groupExpense.description,
        amount: groupExpense.amount,
        paidBy: groupExpense.paidBy,
        date: groupExpense.date.toISOString(),
        isSettlement: groupExpense.isSettlement,
        splits: groupExpense.splits,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create group expense." },
      { status: 400 }
    );
  }
}
