import { format } from "date-fns";
import { SHEET_COLUMNS } from "./sheet-columns";

function formatDate(value?: Date | string | null) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy-MM-dd");
}

export function expenseToRow(doc: {
  amount: number;
  source?: string;
  category: string;
  date: Date;
  note?: string;
  paymentMode: string;
}) {
  return [
    doc.amount,
    doc.source ?? "",
    doc.category,
    formatDate(doc.date),
    doc.note ?? "",
    doc.paymentMode,
  ];
}

export function incomeToRow(doc: {
  amount: number;
  source: string;
  category?: string;
  date: Date;
  note?: string;
  paymentMode: string;
}) {
  return [
    doc.amount,
    doc.source,
    doc.category ?? "",
    formatDate(doc.date),
    doc.note ?? "",
    doc.paymentMode,
  ];
}

export function lendingToRow(doc: {
  person: string;
  type: string;
  amount: number;
  amountReturned: number;
  status: string;
  date: Date;
  dueDate?: Date | null;
  note?: string;
}) {
  return [
    doc.person,
    doc.type,
    doc.amount,
    doc.amountReturned,
    doc.status,
    formatDate(doc.date),
    formatDate(doc.dueDate),
    doc.note ?? "",
  ];
}

export function investmentToRow(doc: {
  type: string;
  name?: string;
  amountInvested: number;
  currentValue?: number;
  date: Date;
  note?: string;
}) {
  return [
    doc.type,
    doc.name ?? "",
    doc.amountInvested,
    doc.currentValue ?? doc.amountInvested,
    formatDate(doc.date),
    doc.note ?? "",
  ];
}

export function bankAccountToRow(doc: {
  bankName: string;
  accountName?: string;
  accountType: string;
  last4Digits?: string;
  currentBalance: number;
  openingBalance?: number;
}) {
  return [
    doc.bankName,
    doc.accountName ?? "",
    doc.accountType,
    doc.last4Digits ?? "",
    doc.currentBalance,
    doc.openingBalance ?? 0,
  ];
}

export function headersForModule(module: keyof typeof SHEET_COLUMNS) {
  return [...SHEET_COLUMNS[module]];
}
