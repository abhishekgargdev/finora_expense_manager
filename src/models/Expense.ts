import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export type ExpenseCategory =
  "Food" | "Travel" | "Rent" | "Utilities" | "Shopping" | "Health" | "Entertainment" | "Other" | string;

export interface IExpense {
  user: Types.ObjectId;
  amount: number;
  source?: string;
  category: ExpenseCategory;
  description?: string;
  note?: string;
  date: Date;
  paymentMode: "Cash" | "UPI" | "Debit Card" | "Credit Card" | "Bank Transfer";
  creditCard?: Types.ObjectId | null;
  bankAccount?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ExpenseDocument = Document & IExpense;

const expenseSchema = new Schema<ExpenseDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    source: { type: String },
    category: { type: String, required: true },
    description: { type: String },
    note: { type: String },
    date: { type: Date, required: true, index: true },
    paymentMode: { type: String, enum: ["Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer"], required: true },
    creditCard: { type: Schema.Types.ObjectId, ref: "CreditCard" },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount" },
  },
  { timestamps: true }
);

expenseSchema.index({ user: 1, date: -1 });

const ExpenseModel =
  (mongoose.models.Expense as Model<ExpenseDocument>) || mongoose.model<ExpenseDocument>("Expense", expenseSchema);

export { ExpenseModel };
export default ExpenseModel;
