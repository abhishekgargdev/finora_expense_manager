import { google } from "googleapis";
import type { GoogleSheetsSyncDocument } from "@/models/GoogleSheetsSync";
import ExpenseModel from "@/models/Expense";
import IncomeModel from "@/models/Income";
import LendingModel from "@/models/Lending";
import InvestmentModel from "@/models/Investment";
import BankAccountModel from "@/models/BankAccount";
import { expenseSheetName, MODULE_SHEET_NAMES } from "./sheet-columns";
import {
  bankAccountToRow,
  expenseToRow,
  headersForModule,
  incomeToRow,
  investmentToRow,
  lendingToRow,
} from "./sheet-row-mappers";
import { calculateNextSyncAt } from "./sync-schedule";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/userinfo.email"];

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/integrations/google-sheets/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret, redirectUri };
}

export function createOAuthClient() {
  const config = getGoogleOAuthConfig();
  if (!config) return null;
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
}

export function getAuthUrl(state: string) {
  const client = createOAuthClient();
  if (!client) throw new Error("Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  if (!client) throw new Error("Google OAuth is not configured.");
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();

  return {
    accessToken: tokens.access_token ?? "",
    refreshToken: tokens.refresh_token ?? "",
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
    connectedEmail: profile.data.email ?? undefined,
  };
}

export async function getAuthenticatedClient(integration: GoogleSheetsSyncDocument) {
  const client = createOAuthClient();
  if (!client) throw new Error("Google OAuth is not configured.");
  if (!integration.refreshToken) throw new Error("Google account is not connected.");

  client.setCredentials({
    access_token: integration.accessToken,
    refresh_token: integration.refreshToken,
    expiry_date: integration.tokenExpiry?.getTime(),
  });

  client.on("tokens", (tokens) => {
    if (tokens.access_token) integration.accessToken = tokens.access_token;
    if (tokens.refresh_token) integration.refreshToken = tokens.refresh_token;
    if (tokens.expiry_date) integration.tokenExpiry = new Date(tokens.expiry_date);
  });

  return client;
}

async function getSpreadsheetTitle(sheets: ReturnType<typeof google.sheets>, spreadsheetId: string) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  return meta.data.properties?.title ?? "Spreadsheet";
}

async function ensureSheetExists(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  headers: string[]
) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = meta.data.sheets?.find((sheet) => sheet.properties?.title === sheetName);

  if (!existing?.properties?.sheetId && existing?.properties?.sheetId !== 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
    return;
  }

  const range = `${quoteSheetName(sheetName)}!A1:Z1`;
  const headerRow = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  if (!headerRow.data.values?.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${quoteSheetName(sheetName)}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] },
    });
  }
}

function quoteSheetName(name: string) {
  return `'${name.replace(/'/g, "''")}'`;
}

async function appendRows(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | number)[][]
) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${quoteSheetName(sheetName)}!A:Z`,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

type SyncResult = {
  appended: Record<string, number>;
  spreadsheetName: string;
};

export async function syncDataToGoogleSheets(userId: string, integration: GoogleSheetsSyncDocument): Promise<SyncResult> {
  if (!integration.spreadsheetId) throw new Error("Spreadsheet ID is required.");

  const auth = await getAuthenticatedClient(integration);
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetName = await getSpreadsheetTitle(sheets, integration.spreadsheetId);
  const appended: Record<string, number> = {
    expense: 0,
    income: 0,
    lending: 0,
    investment: 0,
    bankAccount: 0,
  };

  const synced = {
    expense: new Set(integration.syncedRecordIds?.expense ?? []),
    income: new Set(integration.syncedRecordIds?.income ?? []),
    lending: new Set(integration.syncedRecordIds?.lending ?? []),
    investment: new Set(integration.syncedRecordIds?.investment ?? []),
    bankAccount: new Set(integration.syncedRecordIds?.bankAccount ?? []),
  };

  const expenses = await ExpenseModel.find({ user: userId }).sort({ date: 1 }).lean();
  const expensesBySheet = new Map<string, { id: string; row: (string | number)[] }[]>();

  for (const doc of expenses) {
    const id = String(doc._id);
    if (synced.expense.has(id)) continue;
    const sheetName = expenseSheetName(new Date(doc.date));
    const list = expensesBySheet.get(sheetName) ?? [];
    list.push({ id, row: expenseToRow(doc) });
    expensesBySheet.set(sheetName, list);
  }

  for (const [sheetName, items] of expensesBySheet) {
    await ensureSheetExists(sheets, integration.spreadsheetId, sheetName, headersForModule("expense"));
    await appendRows(
      sheets,
      integration.spreadsheetId,
      sheetName,
      items.map((item) => item.row)
    );
    items.forEach((item) => synced.expense.add(item.id));
    appended.expense += items.length;
  }

  const incomeDocs = await IncomeModel.find({ user: userId }).sort({ date: 1 }).lean();
  const incomeRows: { id: string; row: (string | number)[] }[] = [];
  for (const doc of incomeDocs) {
    const id = String(doc._id);
    if (synced.income.has(id)) continue;
    incomeRows.push({ id, row: incomeToRow(doc) });
  }
  if (incomeRows.length) {
    const sheetName = MODULE_SHEET_NAMES.income;
    await ensureSheetExists(sheets, integration.spreadsheetId, sheetName, headersForModule("income"));
    await appendRows(
      sheets,
      integration.spreadsheetId,
      sheetName,
      incomeRows.map((item) => item.row)
    );
    incomeRows.forEach((item) => synced.income.add(item.id));
    appended.income = incomeRows.length;
  }

  const lendingDocs = await LendingModel.find({ user: userId }).sort({ date: 1 }).lean();
  const lendingRows: { id: string; row: (string | number)[] }[] = [];
  for (const doc of lendingDocs) {
    const id = String(doc._id);
    if (synced.lending.has(id)) continue;
    lendingRows.push({ id, row: lendingToRow(doc) });
  }
  if (lendingRows.length) {
    const sheetName = MODULE_SHEET_NAMES.lending;
    await ensureSheetExists(sheets, integration.spreadsheetId, sheetName, headersForModule("lending"));
    await appendRows(
      sheets,
      integration.spreadsheetId,
      sheetName,
      lendingRows.map((item) => item.row)
    );
    lendingRows.forEach((item) => synced.lending.add(item.id));
    appended.lending = lendingRows.length;
  }

  const investmentDocs = await InvestmentModel.find({ user: userId }).sort({ date: 1 }).lean();
  const investmentRows: { id: string; row: (string | number)[] }[] = [];
  for (const doc of investmentDocs) {
    const id = String(doc._id);
    if (synced.investment.has(id)) continue;
    investmentRows.push({ id, row: investmentToRow(doc) });
  }
  if (investmentRows.length) {
    const sheetName = MODULE_SHEET_NAMES.investment;
    await ensureSheetExists(sheets, integration.spreadsheetId, sheetName, headersForModule("investment"));
    await appendRows(
      sheets,
      integration.spreadsheetId,
      sheetName,
      investmentRows.map((item) => item.row)
    );
    investmentRows.forEach((item) => synced.investment.add(item.id));
    appended.investment = investmentRows.length;
  }

  const bankDocs = await BankAccountModel.find({ user: userId }).sort({ updatedAt: -1 }).lean();
  const bankRows: { id: string; row: (string | number)[] }[] = [];
  for (const doc of bankDocs) {
    const id = String(doc._id);
    if (synced.bankAccount.has(id)) continue;
    bankRows.push({ id, row: bankAccountToRow(doc) });
  }
  if (bankRows.length) {
    const sheetName = MODULE_SHEET_NAMES.bankAccount;
    await ensureSheetExists(sheets, integration.spreadsheetId, sheetName, headersForModule("bankAccount"));
    await appendRows(
      sheets,
      integration.spreadsheetId,
      sheetName,
      bankRows.map((item) => item.row)
    );
    bankRows.forEach((item) => synced.bankAccount.add(item.id));
    appended.bankAccount = bankRows.length;
  }

  integration.syncedRecordIds = {
    expense: Array.from(synced.expense),
    income: Array.from(synced.income),
    lending: Array.from(synced.lending),
    investment: Array.from(synced.investment),
    bankAccount: Array.from(synced.bankAccount),
  };
  integration.lastSyncedAt = new Date();
  integration.nextSyncAt = calculateNextSyncAt({
    scheduleType: integration.scheduleType,
    intervalDays: integration.intervalDays,
    dayOfMonth: integration.dayOfMonth,
    monthOfYear: integration.monthOfYear,
    dayOfYear: integration.dayOfYear,
    from: integration.lastSyncedAt,
  });
  integration.lastSyncStatus = "success";
  integration.lastSyncError = undefined;
  integration.spreadsheetName = spreadsheetName;
  await integration.save();

  return { appended, spreadsheetName };
}

export function validateBankBalances(
  accounts: { id: string; currentBalance: number }[],
  confirmed: { id: string; balance: number }[]
) {
  const mismatches: { id: string; appBalance: number; confirmedBalance: number }[] = [];

  for (const account of accounts) {
    const entry = confirmed.find((item) => item.id === account.id);
    if (!entry) {
      mismatches.push({ id: account.id, appBalance: account.currentBalance, confirmedBalance: NaN });
      continue;
    }
    if (Math.abs(entry.balance - account.currentBalance) > 0.01) {
      mismatches.push({
        id: account.id,
        appBalance: account.currentBalance,
        confirmedBalance: entry.balance,
      });
    }
  }

  return mismatches;
}
