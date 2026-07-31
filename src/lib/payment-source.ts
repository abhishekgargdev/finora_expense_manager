export type PaymentAccountOption = {
  id: string;
  name: string;
  last4Digits?: string;
  bankName?: string;
};

export type ExpensePaymentMode = "Cash" | "UPI" | "Debit Card" | "Credit Card" | "Bank Transfer";

export type PaymentSourceValue = `bank:${string}` | `credit:${string}` | "";

const BANK_MODES = new Set<ExpensePaymentMode>(["UPI", "Debit Card", "Bank Transfer"]);

export function toPaymentSource(bankAccount?: string | null, creditCard?: string | null): PaymentSourceValue {
  if (creditCard) return `credit:${creditCard}`;
  if (bankAccount) return `bank:${bankAccount}`;
  return "";
}

export function parsePaymentSource(value: PaymentSourceValue) {
  if (value.startsWith("credit:")) {
    return { bankAccount: null as string | null, creditCard: value.slice(7) };
  }
  if (value.startsWith("bank:")) {
    return { bankAccount: value.slice(5), creditCard: null as string | null };
  }
  return { bankAccount: null as string | null, creditCard: null as string | null };
}

export function resolvePaymentModeFromSource(
  source: PaymentSourceValue,
  currentMode: ExpensePaymentMode
): ExpensePaymentMode {
  if (source.startsWith("credit:")) return "Credit Card";
  if (source.startsWith("bank:")) {
    if (currentMode === "Credit Card" || currentMode === "Cash") return "UPI";
    return currentMode;
  }
  return currentMode;
}

export function paymentModeNeedsSource(mode: ExpensePaymentMode) {
  return mode !== "Cash";
}

export function isBankPaymentMode(mode: ExpensePaymentMode) {
  return BANK_MODES.has(mode);
}

export function paymentSourceLabel(
  source: PaymentSourceValue,
  bankAccounts: PaymentAccountOption[],
  creditCards: PaymentAccountOption[]
) {
  if (!source) return "";
  if (source.startsWith("credit:")) {
    const card = creditCards.find((item) => item.id === source.slice(7));
    if (!card) return "";
    return `${card.name}${card.last4Digits ? ` · ${card.last4Digits}` : ""}`;
  }
  if (source.startsWith("bank:")) {
    const account = bankAccounts.find((item) => item.id === source.slice(5));
    if (!account) return "";
    return `${account.name}${account.last4Digits ? ` · ${account.last4Digits}` : ""}`;
  }
  return "";
}

export function expensePaymentAccountLabel(
  expense: { paymentMode: ExpensePaymentMode; bankAccount?: string | null; creditCard?: string | null },
  bankAccounts: PaymentAccountOption[],
  creditCards: PaymentAccountOption[]
) {
  if (expense.creditCard) {
    return paymentSourceLabel(`credit:${expense.creditCard}`, bankAccounts, creditCards);
  }
  if (expense.bankAccount) {
    return paymentSourceLabel(`bank:${expense.bankAccount}`, bankAccounts, creditCards);
  }
  return "";
}
