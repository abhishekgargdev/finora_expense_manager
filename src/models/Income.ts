import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export interface IIncome {
  user: Types.ObjectId;
  amount: number;
  source: string;
  category?: string;
  date: Date;
  note?: string;
  paymentMode: "Cash" | "Bank Transfer" | "UPI" | "Other";
  bankAccount?: Types.ObjectId | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IncomeDocument = Document & IIncome;

const incomeSchema = new Schema<IncomeDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true },
    source: { type: String, required: true },
    category: { type: String },
    date: { type: Date, required: true, index: true },
    note: { type: String },
    paymentMode: { type: String, enum: ["Cash", "Bank Transfer", "UPI", "Other"], required: true },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount" },
  },
  { timestamps: true }
);

incomeSchema.index({ user: 1, date: -1 });

const IncomeModel = (mongoose.models.Income as Model<IncomeDocument>) || mongoose.model<IncomeDocument>("Income", incomeSchema);

export { IncomeModel };
export default IncomeModel;
