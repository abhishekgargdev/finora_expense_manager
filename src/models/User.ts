import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document } from "mongoose";

await connect();

export interface IUser {
  name: string;
  email: string;
  password: string;
  createdAt?: Date;
}

export type UserDocument = Document & IUser;

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

const UserModel = (mongoose.models.User as Model<UserDocument>) || mongoose.model<UserDocument>("User", userSchema);

export { UserModel };
export default UserModel;
