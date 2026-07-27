import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export type AccountType = "Savings" | "Current" | "Other";

export interface IBankAccount {
  user: Types.ObjectId;
  bankName: string;
  accountName?: string;
  accountType: AccountType;
  last4Digits?: string;
  currentBalance: number;
  openingBalance?: number;
  themeColor?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type BankAccountDocument = Document & IBankAccount;

const bankAccountSchema = new Schema<BankAccountDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bankName: { type: String, required: true },
    accountName: { type: String },
    accountType: { type: String, enum: ["Savings", "Current", "Other"], default: "Savings" },
    last4Digits: { type: String },
    currentBalance: { type: Number, required: true, default: 0 },
    openingBalance: { type: Number, default: 0 },
    themeColor: { type: String },
  },
  { timestamps: true }
);

bankAccountSchema.index({ user: 1, updatedAt: -1 });

const BankAccountModel = (mongoose.models.BankAccount as Model<BankAccountDocument>) || mongoose.model<BankAccountDocument>("BankAccount", bankAccountSchema);

export { BankAccountModel };
export default BankAccountModel;
