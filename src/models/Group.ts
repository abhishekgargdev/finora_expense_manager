import mongoose, { Schema, Model, Document, Types } from "mongoose";

export interface IGroup {
  user: Types.ObjectId;
  name: string;
  description?: string;
  members: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type GroupDocument = Document & IGroup;

const groupSchema = new Schema<GroupDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    members: { type: [String], required: true },
  },
  { timestamps: true }
);

groupSchema.index({ user: 1, updatedAt: -1 });

const GroupModel =
  (mongoose.models.Group as Model<GroupDocument>) ||
  mongoose.model<GroupDocument>("Group", groupSchema);

export { GroupModel };
export default GroupModel;
