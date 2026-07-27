import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export interface ICategory {
  user: Types.ObjectId;
  name: string;
  type: "Expense" | "Income";
}

export type CategoryDocument = Document & ICategory;

const categorySchema = new Schema<CategoryDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["Expense", "Income"], required: true },
  },
  { timestamps: true }
);

categorySchema.index({ user: 1, type: 1 });

const CategoryModel =
  (mongoose.models.Category as Model<CategoryDocument>) || mongoose.model<CategoryDocument>("Category", categorySchema);

export { CategoryModel };
export default CategoryModel;
