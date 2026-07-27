import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

await connect();

export interface ICreditCard {
  user: Types.ObjectId;
  cardName: string;
  bankName: string;
  last4Digits: string;
  billingCycleDay: number;
  dueDay: number;
  creditLimit: number;
  themeColor?: string;
  createdAt?: Date;
}

export type CreditCardDocument = Document & ICreditCard;

const creditCardSchema = new Schema<CreditCardDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    cardName: { type: String, required: true },
    bankName: { type: String, required: true },
    last4Digits: { type: String, required: true },
    billingCycleDay: { type: Number, min: 1, max: 31 },
    dueDay: { type: Number, min: 1, max: 31 },
    creditLimit: { type: Number, required: true },
    themeColor: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const CreditCardModel = (mongoose.models.CreditCard as Model<CreditCardDocument>) || mongoose.model<CreditCardDocument>("CreditCard", creditCardSchema);

export { CreditCardModel };
export default CreditCardModel;
