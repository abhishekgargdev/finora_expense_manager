import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export interface ICash {
  user: Types.ObjectId;
  balance: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type CashDocument = Document & ICash;

const cashSchema = new Schema<CashDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    balance: { type: Number, required: true, default: 0 },
  },
  { timestamps: true }
);

const CashModel =
  (mongoose.models.Cash as Model<CashDocument>) ||
  mongoose.model<CashDocument>("Cash", cashSchema);

export { CashModel };
export default CashModel;
