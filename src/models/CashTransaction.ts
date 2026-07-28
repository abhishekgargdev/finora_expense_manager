import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";
import CashModel from "./Cash";

export type CashTxType = "Credit" | "Debit";
export type CashTxSource = "Manual" | "Income" | "Expense" | "Lending" | "Withdrawal" | "Deposit" | "Adjustment";

export interface ICashTransaction {
  user: Types.ObjectId;
  type: CashTxType;
  amount: number;
  description?: string;
  date: Date;
  source: CashTxSource;
  refId?: Types.ObjectId | null;
  balanceAfter?: number;
  createdAt?: Date;
}

export type CashTransactionDocument = Document & ICashTransaction;

interface CashTransactionModel extends Model<CashTransactionDocument> {
  recordTransaction(params: {
    user: Types.ObjectId | string;
    type: CashTxType;
    amount: number;
    description?: string;
    date?: Date;
    source?: CashTxSource;
    refId?: Types.ObjectId | string | null;
  }): Promise<CashTransactionDocument>;
}

const cashTxSchema = new Schema<CashTransactionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["Credit", "Debit"], required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    date: { type: Date, required: true, index: true },
    source: { type: String, enum: ["Manual", "Income", "Expense", "Lending", "Withdrawal", "Deposit", "Adjustment"], default: "Manual" },
    refId: { type: Schema.Types.ObjectId },
    balanceAfter: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

cashTxSchema.index({ user: 1, date: -1 });

cashTxSchema.statics.recordTransaction = async function (params: {
  user: Types.ObjectId | string;
  type: CashTxType;
  amount: number;
  description?: string;
  date?: Date;
  source?: CashTxSource;
  refId?: Types.ObjectId | string | null;
}) {
  const CashTransaction = this as CashTransactionModel;
  const { user, type, amount, description, date, source, refId } = params;

  const delta = type === "Credit" ? Math.abs(amount) : -Math.abs(amount);

  const cash = await CashModel.findOneAndUpdate(
    { user },
    { $inc: { balance: delta } },
    { new: true, upsert: true }
  );

  const balanceAfter = cash.balance;

  const tx = await CashTransaction.create({
    user,
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

const CashTransactionModel =
  (mongoose.models.CashTransaction as CashTransactionModel) ||
  mongoose.model<CashTransactionDocument, CashTransactionModel>("CashTransaction", cashTxSchema);

export { CashTransactionModel };
export default CashTransactionModel;
