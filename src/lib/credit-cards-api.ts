import { requireAuth } from "@/lib/auth";
type CardInput = {
  cardName?: unknown;
  bankName?: unknown;
  last4Digits?: unknown;
  billingCycleDay?: unknown;
  dueDay?: unknown;
  creditLimit?: unknown;
  themeColor?: unknown;
};
export type CardRecord = {
  id: string;
  cardName: string;
  bankName: string;
  last4Digits: string;
  billingCycleDay: number;
  dueDay: number;
  creditLimit: number;
  themeColor?: string;
  outstanding: number;
  availableCredit: number;
};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const day = (value: unknown, label: string) => {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > 31) throw new Error(`${label} must be between 1 and 31.`);
  return number;
};
export function parseCard(input: CardInput, partial = false) {
  const values: Record<string, unknown> = {};
  if (!partial || input.cardName !== undefined) {
    const value = text(input.cardName);
    if (!value) throw new Error("Card name is required.");
    values.cardName = value;
  }
  if (!partial || input.bankName !== undefined) {
    const value = text(input.bankName);
    if (!value) throw new Error("Bank name is required.");
    values.bankName = value;
  }
  if (!partial || input.last4Digits !== undefined) {
    const value = text(input.last4Digits);
    if (!/^\d{4}$/.test(value)) throw new Error("Enter the last four card digits.");
    values.last4Digits = value;
  }
  if (!partial || input.billingCycleDay !== undefined)
    values.billingCycleDay = day(input.billingCycleDay, "Billing cycle day");
  if (!partial || input.dueDay !== undefined) values.dueDay = day(input.dueDay, "Due day");
  if (!partial || input.creditLimit !== undefined) {
    const value = Number(input.creditLimit);
    if (!Number.isFinite(value) || value <= 0) throw new Error("Credit limit must be greater than zero.");
    values.creditLimit = value;
  }
  if (input.themeColor !== undefined || !partial) values.themeColor = text(input.themeColor) || undefined;
  return values;
}
export async function getUserId() {
  const session = await requireAuth();
  if (typeof session.userId !== "string") throw new Error("Unauthorized");
  return session.userId;
}
export function serializeCard(
  card: {
    _id: { toString(): string };
    cardName: string;
    bankName: string;
    last4Digits: string;
    billingCycleDay: number;
    dueDay: number;
    creditLimit: number;
    themeColor?: string;
  },
  outstanding = 0
): CardRecord {
  return {
    id: card._id.toString(),
    cardName: card.cardName,
    bankName: card.bankName,
    last4Digits: card.last4Digits,
    billingCycleDay: card.billingCycleDay,
    dueDay: card.dueDay,
    creditLimit: card.creditLimit,
    themeColor: card.themeColor,
    outstanding,
    availableCredit: Math.max(card.creditLimit - outstanding, 0),
  };
}
