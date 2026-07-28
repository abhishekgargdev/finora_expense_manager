"use client";

import * as React from "react";

export type LendingEntry = {
  id: string;
  person: string;
  type: "Given" | "Taken";
  amount: number;
  amountReturned: number;
  status: "Pending" | "Partially Returned" | "Settled";
  date: string;
  dueDate?: string | null;
  note?: string;
  bankAccount?: string | null;
  repayments?: { id: string; amount: number; date: string; bankAccount?: string | null }[];
};
export type BankAccountOption = { id: string; name: string; last4Digits?: string };
export type LendingInput = Pick<LendingEntry, "person" | "type" | "amount" | "date" | "dueDate" | "note" | "bankAccount">;
async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}
export function useLending() {
  const [lending, setLending] = React.useState<LendingEntry[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccountOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const payload = await readJson(await fetch("/api/lending"));
      setLending(payload.lending);
      setBankAccounts(payload.bankAccounts);
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
    async <T>(request: () => Promise<Response>) => {
      setIsMutating(true);
      try {
        const result = await readJson(await request());
        await load();
        return result as T;
      } finally {
        setIsMutating(false);
      }
    },
    [load]
  );
  return {
    lending,
    bankAccounts,
    isLoading,
    isMutating,
    create: (input: LendingInput) =>
      mutate<{ lending: LendingEntry }>(() =>
        fetch("/api/lending", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    update: (id: string, input: Partial<LendingInput>) =>
      mutate<{ lending: LendingEntry }>(() =>
        fetch(`/api/lending/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    remove: (id: string) => mutate<{ success: boolean }>(() => fetch(`/api/lending/${id}`, { method: "DELETE" })),
    repay: (id: string, input: { amount: number; date?: string; bankAccount?: string }) =>
      mutate<{ lending: LendingEntry }>(() =>
        fetch(`/api/lending/${id}/repayment`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
  };
}
