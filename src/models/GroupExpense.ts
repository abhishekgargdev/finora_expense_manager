import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IGroupSplit {
  member: string;
  amount: number;
}

export interface IGroupExpense {
  user: Types.ObjectId;
  group: Types.ObjectId;
  description: string;
  amount: number;
  paidBy: string;
  date: Date;
  splits: IGroupSplit[];
  isSettlement: boolean;
  expenseRef?: Types.ObjectId | null;
  lendingRefs?: Types.ObjectId[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type GroupExpenseDocument = Document & IGroupExpense;

const groupExpenseSchema = new Schema<GroupExpenseDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    group: { type: Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    description: { type: String, required: true },
    amount: { type: Number, required: true },
    paidBy: { type: String, required: true },
    date: { type: Date, required: true, index: true },
    splits: [
      {
        member: { type: String, required: true },
        amount: { type: Number, required: true },
      },
    ],
    isSettlement: { type: Boolean, default: false },
    expenseRef: { type: Schema.Types.ObjectId, ref: "Expense" },
    lendingRefs: { type: [{ type: Schema.Types.ObjectId, ref: "Lending" }], default: [] },
  },
  { timestamps: true }
);

groupExpenseSchema.index({ group: 1, date: -1 });

const GroupExpenseModel =
  (mongoose.models.GroupExpense as Model<GroupExpenseDocument>) ||
  mongoose.model<GroupExpenseDocument>("GroupExpense", groupExpenseSchema);

export { GroupExpenseModel };
export default GroupExpenseModel;
