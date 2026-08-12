export const SHEET_COLUMNS = {
  expense: ["Amount", "Source", "Category", "Date", "Note", "Payment Mode"],
  income: ["Amount", "Source", "Category", "Date", "Note", "Payment Mode"],
  investment: ["Type", "Name", "Amount Invested", "Current Value", "Date", "Note"],
  lending: ["Person", "Type", "Amount", "Amount Returned", "Status", "Date", "Due Date", "Note"],
  bankAccount: ["Bank Name", "Account Name", "Account Type", "Last 4 Digits", "Current Balance", "Opening Balance"],
} as const;

export type SheetModule = keyof typeof SHEET_COLUMNS;

export const MODULE_SHEET_NAMES: Record<Exclude<SheetModule, "expense">, string> = {
  income: "Income",
  lending: "Lending",
  investment: "Investments",
  bankAccount: "Bank Accounts",
};

export function expenseSheetName(date: Date) {
  const month = date.toLocaleString("default", { month: "short" });
  return `Expenses ${month} ${date.getFullYear()}`;
}

export function parseSpreadsheetId(input: string) {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]+$/.test(trimmed)) return trimmed;
  return null;
}
