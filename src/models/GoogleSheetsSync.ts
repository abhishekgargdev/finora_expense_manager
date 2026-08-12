import { mongoose } from "../lib/db";
import { Schema, Model, Document, Types } from "mongoose";

export type SyncScheduleType = "interval" | "monthly" | "yearly";

export interface IGoogleSheetsSync {
  user: Types.ObjectId;
  enabled: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: Date;
  connectedEmail?: string;
  scheduleType: SyncScheduleType;
  intervalDays?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  dayOfYear?: number;
  lastSyncedAt?: Date;
  nextSyncAt?: Date;
  syncedRecordIds: {
    expense: string[];
    income: string[];
    lending: string[];
    investment: string[];
    bankAccount: string[];
  };
  lastSyncError?: string;
  lastSyncStatus?: "success" | "failed" | "pending";
  createdAt?: Date;
  updatedAt?: Date;
}

export type GoogleSheetsSyncDocument = Document & IGoogleSheetsSync;

const googleSheetsSyncSchema = new Schema<GoogleSheetsSyncDocument>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    enabled: { type: Boolean, default: false },
    spreadsheetId: { type: String },
    spreadsheetUrl: { type: String },
    spreadsheetName: { type: String },
    accessToken: { type: String },
    refreshToken: { type: String },
    tokenExpiry: { type: Date },
    connectedEmail: { type: String },
    scheduleType: { type: String, enum: ["interval", "monthly", "yearly"], default: "monthly" },
    intervalDays: { type: Number, default: 30, min: 1, max: 365 },
    dayOfMonth: { type: Number, default: 1, min: 1, max: 28 },
    monthOfYear: { type: Number, default: 1, min: 1, max: 12 },
    dayOfYear: { type: Number, default: 1, min: 1, max: 28 },
    lastSyncedAt: { type: Date },
    nextSyncAt: { type: Date },
    syncedRecordIds: {
      expense: { type: [String], default: [] },
      income: { type: [String], default: [] },
      lending: { type: [String], default: [] },
      investment: { type: [String], default: [] },
      bankAccount: { type: [String], default: [] },
    },
    lastSyncError: { type: String },
    lastSyncStatus: { type: String, enum: ["success", "failed", "pending"] },
  },
  { timestamps: true }
);

const GoogleSheetsSyncModel =
  (mongoose.models.GoogleSheetsSync as Model<GoogleSheetsSyncDocument>) ||
  mongoose.model<GoogleSheetsSyncDocument>("GoogleSheetsSync", googleSheetsSyncSchema);

export { GoogleSheetsSyncModel };
export default GoogleSheetsSyncModel;
