import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export interface IInvestmentContribution {
  user: Types.ObjectId;
  investment: Types.ObjectId;
  dueDate: Date;
  paidDate?: Date | null;
  amount: number;
  status: "Paid" | "Pending" | "Missed";
  bankAccount?: Types.ObjectId | null;
  expenseRef?: Types.ObjectId | null;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InvestmentContributionDocument = Document & IInvestmentContribution;

const investmentContributionSchema = new Schema<InvestmentContributionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    investment: { type: Schema.Types.ObjectId, ref: "Investment", required: true, index: true },
    dueDate: { type: Date, required: true, index: true },
    paidDate: { type: Date },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["Paid", "Pending", "Missed"],
      default: "Pending",
      required: true,
    },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount" },
    expenseRef: { type: Schema.Types.ObjectId, ref: "Expense" },
    note: { type: String },
  },
  { timestamps: true }
);

// Index to quickly query active schedules for a user
investmentContributionSchema.index({ user: 1, dueDate: 1 });

const InvestmentContributionModel =
  (mongoose.models.InvestmentContribution as Model<InvestmentContributionDocument>) ||
  mongoose.model<InvestmentContributionDocument>(
    "InvestmentContribution",
    investmentContributionSchema
  );

export { InvestmentContributionModel };
export default InvestmentContributionModel;
