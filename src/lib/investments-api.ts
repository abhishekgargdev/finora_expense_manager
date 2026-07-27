import { requireAuth } from "@/lib/auth";

const TYPES = ["Mutual Fund", "Stocks", "FD", "RD", "Gold", "Crypto", "PPF", "Other"] as const;
type InvestmentInput = {
  type?: unknown;
  name?: unknown;
  amountInvested?: unknown;
  currentValue?: unknown;
  date?: unknown;
  note?: unknown;
};
export type InvestmentRecord = {
  id: string;
  type: string;
  name?: string;
  amountInvested: number;
  currentValue: number;
  date: string;
  note?: string;
};

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export function parseInvestment(input: InvestmentInput, partial = false) {
  const values: Record<string, unknown> = {};
  if (!partial || input.type !== undefined) {
    const type = text(input.type);
    if (!TYPES.includes(type as (typeof TYPES)[number])) throw new Error("Choose a valid investment type.");
    values.type = type;
  }
  for (const key of ["amountInvested", "currentValue"] as const)
    if (!partial || input[key] !== undefined) {
      const value = Number(input[key]);
      if (!Number.isFinite(value) || value < 0 || (key === "amountInvested" && value === 0))
        throw new Error(`${key === "amountInvested" ? "Amount invested" : "Current value"} must be valid.`);
      values[key] = value;
    }
  if (!partial || input.date !== undefined) {
    const date = new Date(text(input.date));
    if (Number.isNaN(date.getTime())) throw new Error("A valid date is required.");
    values.date = date;
  }
  if (input.name !== undefined || !partial) values.name = text(input.name) || undefined;
  if (input.note !== undefined || !partial) values.note = text(input.note) || undefined;
  return values;
}

export function serializeInvestment(item: {
  _id: { toString(): string };
  type: string;
  name?: string;
  amountInvested: number;
  currentValue?: number;
  date: Date;
  note?: string;
}): InvestmentRecord {
  return {
    id: item._id.toString(),
    type: item.type,
    name: item.name,
    amountInvested: item.amountInvested,
    currentValue: item.currentValue ?? item.amountInvested,
    date: item.date.toISOString(),
    note: item.note,
  };
}

export async function getUserId() {
  const session = await requireAuth();
  if (typeof session.userId !== "string") throw new Error("Unauthorized");
  return session.userId;
}
