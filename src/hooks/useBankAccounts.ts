"use client";
import * as React from "react";
export type BankAccount = {
  id: string;
  bankName: string;
  accountName?: string;
  accountType: "Savings" | "Current" | "Other";
  last4Digits?: string;
  currentBalance: number;
  openingBalance: number;
  minimumBalance: number;
  themeColor?: string;
};
export type BankTransaction = {
  id: string;
  type: "Credit" | "Debit";
  amount: number;
  description?: string;
  date: string;
  source: string;
  refId?: string | null;
  balanceAfter?: number;
};
export type BankAccountInput = Omit<BankAccount, "id" | "currentBalance">;
async function json(response: Response | Promise<Response>) {
  const result = await response;
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}
export function useBankAccounts() {
  const [accounts, setAccounts] = React.useState<BankAccount[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      setAccounts((await json(fetch("/api/bank-accounts"))).accounts);
    } finally {
      setIsLoading(false);
    }
  }, []);
  React.useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await load();
    })();
  }, [load]);
  const mutate = React.useCallback(
    async <T>(call: () => Promise<Response>) => {
      setIsMutating(true);
      try {
        const value = await json(call());
        await load();
        return value as T;
      } finally {
        setIsMutating(false);
      }
    },
    [load]
  );
  return {
    accounts,
    isLoading,
    isMutating,
    create: (input: BankAccountInput) =>
      mutate(() =>
        fetch("/api/bank-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    update: (id: string, input: Partial<BankAccountInput> & { currentBalance?: number }) =>
      mutate<{ account: BankAccount }>(() =>
        fetch(`/api/bank-accounts/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    remove: (id: string) => mutate(() => fetch(`/api/bank-accounts/${id}`, { method: "DELETE" })),
    transaction: (id: string, input: { type: "Credit" | "Debit"; amount: number; description: string; date: string }) =>
      mutate(() =>
        fetch(`/api/bank-accounts/${id}/transactions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    transfer: (input: { fromAccountId: string; toAccountId: string; amount: number; description?: string; date?: string }) =>
      mutate<void>(() =>
        fetch("/api/bank-accounts/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
  };
}
