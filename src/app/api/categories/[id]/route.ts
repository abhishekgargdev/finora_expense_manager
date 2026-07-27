import { NextRequest, NextResponse } from "next/server";
import connect from "@/lib/db";
import CategoryModel from "@/models/Category";
import ExpenseModel from "@/models/Expense";
import IncomeModel from "@/models/Income";
import { getUserId } from "@/lib/expenses-api";

export async function PATCH(request: NextRequest, context: RouteContext<"/api/categories/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const newName = typeof body.name === "string" ? body.name.trim() : "";

    if (!newName) throw new Error("Category name is required.");

    const category = await CategoryModel.findOne({ _id: id, user: userId });
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const oldName = category.name;
    category.name = newName;
    await category.save();

    // Cascade rename to existing expenses/income records
    if (category.type === "Expense") {
      await ExpenseModel.updateMany({ user: userId, category: oldName }, { category: newName });
    } else {
      await IncomeModel.updateMany({ user: userId, category: oldName }, { category: newName });
    }

    return NextResponse.json({
      category: {
        id: category._id.toString(),
        name: category.name,
        type: category.type,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update category." },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext<"/api/categories/[id]">) {
  try {
    await connect();
    const userId = await getUserId();
    const { id } = await context.params;

    const category = await CategoryModel.findOne({ _id: id, user: userId });
    if (!category) {
      return NextResponse.json({ error: "Category not found." }, { status: 404 });
    }

    const name = category.name;
    const type = category.type;
    await category.deleteOne();

    // Fall back existing transactions to "Other"
    if (type === "Expense") {
      await ExpenseModel.updateMany({ user: userId, category: name }, { category: "Other" });
    } else {
      await IncomeModel.updateMany({ user: userId, category: name }, { category: "Other" });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete category." },
      { status: 400 }
    );
  }
}
