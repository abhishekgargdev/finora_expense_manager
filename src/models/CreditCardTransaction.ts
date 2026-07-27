import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export interface ICreditCardTransaction {
  user: Types.ObjectId;
  creditCard: Types.ObjectId;
  amount: number;
  description?: string;
  date: Date;
  billed: boolean;
  billingMonth?: string;
  expenseRef?: Types.ObjectId | null;
  createdAt?: Date;
}

export type CreditCardTransactionDocument = Document & ICreditCardTransaction;

const ccTxSchema = new Schema<CreditCardTransactionDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    creditCard: { type: Schema.Types.ObjectId, ref: "CreditCard", required: true },
    amount: { type: Number, required: true },
    description: { type: String },
    date: { type: Date, required: true, index: true },
    billed: { type: Boolean, default: false },
    billingMonth: { type: String },
    expenseRef: { type: Schema.Types.ObjectId, ref: "Expense" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ccTxSchema.index({ user: 1, date: -1 });

const CreditCardTransactionModel =
  (mongoose.models.CreditCardTransaction as Model<CreditCardTransactionDocument>) ||
  mongoose.model<CreditCardTransactionDocument>("CreditCardTransaction", ccTxSchema);

export { CreditCardTransactionModel };
export default CreditCardTransactionModel;
