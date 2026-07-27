import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import CategoryModel from "@/models/Category";
import { getUserId } from "@/lib/expenses-api"; // standard session helper

const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Travel",
  "Rent",
  "Utilities",
  "Shopping",
  "Health",
  "Entertainment",
  "Other",
];
const DEFAULT_INCOME_CATEGORIES = ["Salary", "Freelance", "Investments", "Rental", "Bonus", "Other"];

export async function GET(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();

    let categories = await CategoryModel.find({ user: userId }).sort({ name: 1 }).lean();

    if (categories.length === 0) {
      const defaults = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ user: userId, name, type: "Expense" })),
        ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ user: userId, name, type: "Income" })),
      ];
      await CategoryModel.insertMany(defaults);
      categories = await CategoryModel.find({ user: userId }).sort({ name: 1 }).lean();
    }

    return NextResponse.json({
      categories: categories.map((cat) => ({
        id: cat._id.toString(),
        name: cat.name,
        type: cat.type,
      })),
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load categories." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connect();
    const userId = await getUserId();
    const body = await request.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const type = body.type;

    if (!name) throw new Error("Category name is required.");
    if (type !== "Expense" && type !== "Income") throw new Error("Category type must be Expense or Income.");

    // Check if category name already exists for this user and type (case insensitive)
    const exists = await CategoryModel.findOne({
      user: userId,
      type,
      name: { $regex: new RegExp(`^${name.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}$`, "i") },
    });

    if (exists) {
      return NextResponse.json({
        category: {
          id: exists._id.toString(),
          name: exists.name,
          type: exists.type,
        },
      });
    }

    const category = await CategoryModel.create({
      user: userId,
      name,
      type,
    });

    return NextResponse.json(
      {
        category: {
          id: category._id.toString(),
          name: category.name,
          type: category.type,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create category." },
      { status: 400 }
    );
  }
}
