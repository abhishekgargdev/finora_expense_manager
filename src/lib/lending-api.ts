import { requireAuth } from "@/lib/auth";
import BankAccountModel from "@/models/BankAccount";

const TYPES = ["Given", "Taken"] as const;
type LendingInput = {
  person?: unknown;
  type?: unknown;
  amount?: unknown;
  date?: unknown;
  dueDate?: unknown;
  note?: unknown;
  amountReturned?: unknown;
};
export type LendingRecord = {
  id: string;
  person: string;
  type: "Given" | "Taken";
  amount: number;
  amountReturned: number;
  status: "Pending" | "Partially Returned" | "Settled";
  date: string;
  dueDate?: string | null;
  note?: string;
  repayments?: { id: string; amount: number; date: string; bankAccount?: string | null }[];
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const dateValue = (value: unknown, label: string, required = true) => {
  const raw = text(value);
  if (!raw && !required) return null;
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) throw new Error(`A valid ${label} is required.`);
  return date;
};

export function parseLending(input: LendingInput, partial = false) {
  const values: Record<string, unknown> = {};
  if (!partial || input.person !== undefined) {
    const person = text(input.person);
    if (!person) throw new Error("Person is required.");
    values.person = person;
  }
  if (!partial || input.type !== undefined) {
    const type = text(input.type);
    if (!TYPES.includes(type as (typeof TYPES)[number]))
      throw new Error("Choose whether the money was given or taken.");
    values.type = type;
  }
  if (!partial || input.amount !== undefined) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero.");
    values.amount = amount;
  }
  if (!partial || input.date !== undefined) values.date = dateValue(input.date, "date");
  if (input.dueDate !== undefined || !partial) values.dueDate = dateValue(input.dueDate, "due date", false);
  if (input.note !== undefined || !partial) values.note = text(input.note) || undefined;
  if (input.amountReturned !== undefined) {
    const amountReturned = Number(input.amountReturned);
    if (!Number.isFinite(amountReturned) || amountReturned < 0) throw new Error("Returned amount must be valid.");
    values.amountReturned = amountReturned;
  }
  return values;
}

export function serializeLending(item: any): LendingRecord {
  return {
    id: item._id.toString(),
    person: item.person,
    type: item.type,
    amount: item.amount,
    amountReturned: item.amountReturned,
    status: item.status,
    date: item.date.toISOString(),
    dueDate: item.dueDate?.toISOString() ?? null,
    note: item.note,
    repayments:
      item.repayments?.map((r: any) => ({
        id: r._id?.toString() || "",
        amount: r.amount,
        date: r.date.toISOString(),
        bankAccount: r.bankAccount?.toString() ?? null,
      })) || [],
  };
}

export async function getUserId() {
  const session = await requireAuth();
  if (typeof session.userId !== "string") throw new Error("Unauthorized");
  return session.userId;
}

export async function ensureBankAccount(userId: string, value?: unknown) {
  const id = text(value);
  if (!id) return undefined;
  if (!(await BankAccountModel.exists({ _id: id, user: userId })))
    throw new Error("The selected bank account was not found.");
  return id;
}
