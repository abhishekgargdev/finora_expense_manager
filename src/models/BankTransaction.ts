import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";
import BankAccountModel, { BankAccountDocument } from "./BankAccount";

export type BankTxType = "Credit" | "Debit";
export type BankTxSource = "Manual" | "Income" | "Expense" | "Lending" | "Transfer";

export interface IBankTransaction {
  user: Types.ObjectId;
  bankAccount: Types.ObjectId;
  type: BankTxType;
  amount: number;
  description?: string;
  date: Date;
  source: BankTxSource;
  refId?: Types.ObjectId | null;
  balanceAfter?: number;
  createdAt?: Date;
}

export type BankTransactionDocument = Document & IBankTransaction;

interface BankTransactionModel extends Model<BankTransactionDocument> {
  recordTransaction(params: {
    user: Types.ObjectId | string;
    bankAccount: Types.ObjectId | string;
    type: BankTxType;
    amount: number;
    description?: string;
    date?: Date;
    source?: BankTxSource;
    refId?: Types.ObjectId | string | null;
  }): Promise<BankTransactionDocument>;
}

const bankTxSchema = new Schema<BankTransactionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount", required: true },
    type: { type: String, enum: ["Credit", "Debit"], required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    date: { type: Date, required: true, index: true },
    source: { type: String, enum: ["Manual", "Income", "Expense", "Lending", "Transfer"], default: "Manual" },
    refId: { type: Schema.Types.ObjectId },
    balanceAfter: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

bankTxSchema.index({ user: 1, date: -1 });

// Static method to create a transaction and update bank account balance atomically-ish
bankTxSchema.statics.recordTransaction = async function (params: {
  user: Types.ObjectId | string;
  bankAccount: Types.ObjectId | string;
  type: BankTxType;
  amount: number;
  description?: string;
  date?: Date;
  source?: BankTxSource;
  refId?: Types.ObjectId | string | null;
}) {
  const BankTransaction = this as BankTransactionModel;

  const { user, bankAccount, type, amount, description, date, source, refId } = params;
  if (!bankAccount) throw new Error("bankAccount is required");

  // update account currentBalance
  const delta = type === "Credit" ? Math.abs(amount) : -Math.abs(amount);

  const account = await BankAccountModel.findByIdAndUpdate(
    bankAccount,
    { $inc: { currentBalance: delta } },
    { new: true }
  );
  if (!account) throw new Error("BankAccount not found");

  const balanceAfter = account.currentBalance;

  const tx = await BankTransaction.create({
    user,
    bankAccount,
    type,
    amount,
    description,
    date: date ?? new Date(),
    source: source ?? "Manual",
    refId: refId ?? null,
    balanceAfter,
  });

  return tx;
};

const BankTransactionModel =
  (mongoose.models.BankTransaction as BankTransactionModel) ||
  mongoose.model<BankTransactionDocument, BankTransactionModel>("BankTransaction", bankTxSchema);

export { BankTransactionModel };
export default BankTransactionModel;
