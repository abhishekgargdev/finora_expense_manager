"use client";
import * as React from "react";

export type CashTransaction = {
  id: string;
  type: "Credit" | "Debit";
  amount: number;
  description?: string;
  date: string;
  source: "Manual" | "Income" | "Expense" | "Lending" | "Withdrawal" | "Deposit" | "Adjustment";
  refId?: string | null;
  balanceAfter?: number;
};

async function json(response: Response | Promise<Response>) {
  const result = await response;
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}

export function useCashWallet() {
  const [balance, setBalance] = React.useState<number>(0);
  const [transactions, setTransactions] = React.useState<CashTransaction[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await json(fetch("/api/cash-wallet"));
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (err) {
      console.error(err);
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
    balance,
    transactions,
    isLoading,
    isMutating,
    load,
    recordTransaction: (input: { type: "Credit" | "Debit"; amount: number; description: string; date: string }) =>
      mutate<{ transaction: CashTransaction }>(() =>
        fetch("/api/cash-wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    transfer: (input: { direction: "Withdrawal" | "Deposit"; bankAccountId: string; amount: number; description?: string; date?: string }) =>
      mutate<void>(() =>
        fetch("/api/cash-wallet/transfer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
  };
}
