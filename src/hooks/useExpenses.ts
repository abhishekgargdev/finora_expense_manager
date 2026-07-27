"use client";

import * as React from "react";

export type ExpenseEntry = {
  id: string;
  amount: number;
  source?: string;
  category: string;
  date: string;
  paymentMode: "Cash" | "UPI" | "Debit Card" | "Credit Card" | "Bank Transfer";
  bankAccount?: string | null;
  creditCard?: string | null;
  note?: string;
};
export type ExpenseInput = Omit<ExpenseEntry, "id">;
export type PaymentAccountOption = { id: string; name: string; last4Digits?: string; bankName?: string };
export type ExpenseFilters = { month?: number; year?: number; category?: string; sort?: string };

async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}

export function useExpenses(filters: ExpenseFilters = {}) {
  const [expenses, setExpenses] = React.useState<ExpenseEntry[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<PaymentAccountOption[]>([]);
  const [creditCards, setCreditCards] = React.useState<PaymentAccountOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const { month, year, category, sort } = filters;
  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries({ month, year, category, sort }).forEach(([key, value]) => {
        if (value !== undefined && value !== "") params.set(key, String(value));
      });
      const payload = await readJson(await fetch(`/api/expenses?${params.toString()}`));
      setExpenses(payload.expenses);
      setBankAccounts(payload.bankAccounts);
      setCreditCards(payload.creditCards);
    } finally {
      setIsLoading(false);
    }
  }, [month, year, category, sort]);
  React.useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [load]);
  const mutate = React.useCallback(
    async <T>(request: () => Promise<Response>) => {
      setIsMutating(true);
      try {
        const payload = await readJson(await request());
        await load();
        return payload as T;
      } finally {
        setIsMutating(false);
      }
    },
    [load]
  );
  return {
    expenses,
    bankAccounts,
    creditCards,
    isLoading,
    isMutating,
    refetch: load,
    create: (input: ExpenseInput) =>
      mutate<{ expense: ExpenseEntry }>(() =>
        fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    update: (id: string, input: Partial<ExpenseInput>) =>
      mutate<{ expense: ExpenseEntry }>(() =>
        fetch(`/api/expenses/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    remove: (id: string) => mutate<{ success: boolean }>(() => fetch(`/api/expenses/${id}`, { method: "DELETE" })),
  };
}

export const useExpense = useExpenses;
