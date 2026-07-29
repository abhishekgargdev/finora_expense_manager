import connect, { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export type InvestmentType =
  | "Mutual Fund"
  | "Stocks"
  | "FD"
  | "RD"
  | "Gold"
  | "Crypto"
  | "PPF"
  | "NPS"
  | "Bonds"
  | "Bank RD Plan"
  | "Other";

export interface IInvestment {
  user: Types.ObjectId;
  type: InvestmentType;
  name?: string;
  amountInvested: number;
  currentValue?: number;
  date: Date;
  note?: string;
  
  // Fixed-Tenure details
  category: "Market-Linked" | "Fixed-Tenure";
  investmentMode?: "Lumpsum" | "Recurring";
  institution?: string;
  planName?: string;
  accountOrPolicyNumber?: string;
  bankAccount?: Types.ObjectId | null;
  expenseRef?: Types.ObjectId | null;
  principalAmount?: number;
  installmentAmount?: number;
  installmentFrequency?: "Monthly" | "Quarterly";
  interestRate?: number;
  compoundingFrequency?: "Monthly" | "Quarterly" | "Half-Yearly" | "Annually" | "At Maturity";
  startDate?: Date;
  tenureValue?: number;
  tenureUnit?: "Months" | "Years";
  maturityDate?: Date;
  expectedMaturityAmount?: number;
  status?: "Active" | "Matured" | "Closed Prematurely";
  actualMaturityAmount?: number;
  actualClosureDate?: Date;
  
  createdAt?: Date;
  updatedAt?: Date;
}

export type InvestmentDocument = Document & IInvestment;

const investmentSchema = new Schema<InvestmentDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: [
        "Mutual Fund",
        "Stocks",
        "FD",
        "RD",
        "Gold",
        "Crypto",
        "PPF",
        "NPS",
        "Bonds",
        "Bank RD Plan",
        "Other",
      ],
      required: true,
    },
    name: { type: String },
    amountInvested: { type: Number, required: true },
    currentValue: { type: Number },
    date: { type: Date, required: true, index: true },
    note: { type: String },
    
    // Fixed-Tenure fields
    category: {
      type: String,
      enum: ["Market-Linked", "Fixed-Tenure"],
      default: function (this: any) {
        if (["Mutual Fund", "Stocks", "Gold", "Crypto"].includes(this.type)) {
          return "Market-Linked";
        }
        return "Fixed-Tenure";
      },
      required: true,
    },
    investmentMode: {
      type: String,
      enum: ["Lumpsum", "Recurring"],
    },
    institution: { type: String },
    planName: { type: String },
    accountOrPolicyNumber: { type: String },
    bankAccount: { type: Schema.Types.ObjectId, ref: "BankAccount" },
    expenseRef: { type: Schema.Types.ObjectId, ref: "Expense" },
    principalAmount: { type: Number, default: 0 },
    installmentAmount: { type: Number },
    installmentFrequency: {
      type: String,
      enum: ["Monthly", "Quarterly"],
      default: "Monthly",
    },
    interestRate: { type: Number },
    compoundingFrequency: {
      type: String,
      enum: ["Monthly", "Quarterly", "Half-Yearly", "Annually", "At Maturity"],
      default: "Quarterly",
    },
    startDate: { type: Date },
    tenureValue: { type: Number },
    tenureUnit: {
      type: String,
      enum: ["Months", "Years"],
    },
    maturityDate: { type: Date },
    expectedMaturityAmount: { type: Number },
    status: {
      type: String,
      enum: ["Active", "Matured", "Closed Prematurely"],
      default: "Active",
    },
    actualMaturityAmount: { type: Number },
    actualClosureDate: { type: Date },
  },
  { timestamps: true }
);

investmentSchema.index({ user: 1, date: -1 });

const InvestmentModel =
  (mongoose.models.Investment as Model<InvestmentDocument>) ||
  mongoose.model<InvestmentDocument>("Investment", investmentSchema);

export { InvestmentModel };
export default InvestmentModel;

