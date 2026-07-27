import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export interface ICreditCardBill {
  user: Types.ObjectId;
  creditCard: Types.ObjectId;
  billingMonth: string;
  totalAmount: number;
  dueDate: Date;
  isPaid: boolean;
  paidDate?: Date | null;
  paidAmount?: number;
  createdAt?: Date;
}

export type CreditCardBillDocument = Document & ICreditCardBill;

const billSchema = new Schema<CreditCardBillDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    creditCard: { type: Schema.Types.ObjectId, ref: "CreditCard", required: true },
    billingMonth: { type: String, required: true },
    totalAmount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    isPaid: { type: Boolean, default: false },
    paidDate: { type: Date },
    paidAmount: { type: Number },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CreditCardBillModel = (mongoose.models.CreditCardBill as Model<CreditCardBillDocument>) || mongoose.model<CreditCardBillDocument>("CreditCardBill", billSchema);

export { CreditCardBillModel };
export default CreditCardBillModel;
