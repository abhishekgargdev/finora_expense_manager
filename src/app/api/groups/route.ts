import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import GroupModel from "@/models/Group";
import GroupExpenseModel from "@/models/GroupExpense";
import { getUserId } from "@/lib/bank-accounts-api";

export async function GET() {
  try {
    await connect();
    const userId = await getUserId();

    const groups = await GroupModel.find({ user: userId }).sort({ updatedAt: -1 }).lean();

    const groupsWithBalances = await Promise.all(
      groups.map(async (group) => {
        const expenses = await GroupExpenseModel.find({ group: group._id }).lean();
        
        let totalExpense = 0;
        let userPaid = 0;
        let userShare = 0;

        for (const exp of expenses) {
          // Exclude settlements from the group spending total if wanted,
          // but for general stats we just sum regular expenses
          if (!exp.isSettlement) {
            totalExpense += exp.amount;
          }

          if (exp.paidBy.toLowerCase() === "you") {
            userPaid += exp.amount;
          }

          const userSplit = exp.splits.find((s) => s.member.toLowerCase() === "you");
          if (userSplit) {
            userShare += userSplit.amount;
          }
        }

        const userBalance = userPaid - userShare;

        return {
          id: group._id.toString(),
          name: group.name,
          description: group.description,
          members: group.members,
          totalExpense,
          userBalance,
        };
      })
    );

    return NextResponse.json({ groups: groupsWithBalances });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load groups." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    let members = Array.isArray(body.members) ? body.members.map((m: unknown) => String(m).trim()).filter(Boolean) : [];

    if (!name) throw new Error("Group name is required.");
    
    // Ensure "You" is always in the group members list
    if (!members.some((m: string) => m.toLowerCase() === "you")) {
      members = ["You", ...members];
    }

    const group = await GroupModel.create({
      user: userId,
      name,
      description,
      members,
    });

    return NextResponse.json({
      group: {
        id: group._id.toString(),
        name: group.name,
        description: group.description,
        members: group.members,
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create group." },
      { status: 400 }
    );
  }
}
