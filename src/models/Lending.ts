import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export type LendingType = "Given" | "Taken";
export type LendingStatus = "Pending" | "Partially Returned" | "Settled";

export interface ILending {
  user: Types.ObjectId;
  person: string;
  type: LendingType;
  amount: number;
  amountReturned: number;
  status: LendingStatus;
  date: Date;
  dueDate?: Date | null;
  note?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type LendingDocument = Document & ILending;

const lendingSchema = new Schema<LendingDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    person: { type: String, required: true },
    type: { type: String, enum: ["Given", "Taken"], required: true },
    amount: { type: Number, required: true },
    amountReturned: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ["Pending", "Partially Returned", "Settled"], default: "Pending" },
    date: { type: Date, required: true, index: true },
    dueDate: { type: Date },
    note: { type: String },
  },
  { timestamps: true }
);

// auto-derive status before save
lendingSchema.pre<LendingDocument>("save", function () {
  if (this.amountReturned >= this.amount) {
    this.status = "Settled";
  } else if (this.amountReturned > 0) {
    this.status = "Partially Returned";
  } else {
    this.status = "Pending";
  }
});

lendingSchema.index({ user: 1, date: -1 });

const LendingModel = (mongoose.models.Lending as Model<LendingDocument>) || mongoose.model<LendingDocument>("Lending", lendingSchema);

export { LendingModel };
export default LendingModel;
