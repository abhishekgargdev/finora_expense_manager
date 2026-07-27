import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export type InvestmentType = "Mutual Fund" | "Stocks" | "FD" | "RD" | "Gold" | "Crypto" | "PPF" | "Other";

export interface IInvestment {
  user: Types.ObjectId;
  type: InvestmentType;
  name?: string;
  amountInvested: number;
  currentValue?: number;
  date: Date;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type InvestmentDocument = Document & IInvestment;

const investmentSchema = new Schema<InvestmentDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["Mutual Fund", "Stocks", "FD", "RD", "Gold", "Crypto", "PPF", "Other"], required: true },
    name: { type: String },
    amountInvested: { type: Number, required: true },
    currentValue: { type: Number },
    date: { type: Date, required: true, index: true },
    note: { type: String },
  },
  { timestamps: true }
);

investmentSchema.index({ user: 1, date: -1 });

const InvestmentModel = (mongoose.models.Investment as Model<InvestmentDocument>) || mongoose.model<InvestmentDocument>("Investment", investmentSchema);

export { InvestmentModel };
export default InvestmentModel;
