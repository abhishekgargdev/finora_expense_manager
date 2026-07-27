"use client";

import * as React from "react";

export type IncomeEntry = {
  id: string;
  amount: number;
  source: string;
  category?: string;
  date: string;
  note?: string;
  paymentMode: "Cash" | "Bank Transfer" | "UPI" | "Other";
  bankAccount?: string | null;
};

export type BankAccountOption = {
  id: string;
  name: string;
  bankName: string;
  last4Digits?: string;
};

export type IncomeInput = Omit<IncomeEntry, "id">;
export type IncomeFilters = { month?: number; year?: number; category?: string; sort?: string };

async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}

export function useIncome(filters: IncomeFilters = {}) {
  const [income, setIncome] = React.useState<IncomeEntry[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccountOption[]>([]);
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
      const payload = await readJson(await fetch(`/api/income?${params.toString()}`));
      setIncome(payload.income);
      setBankAccounts(payload.bankAccounts);
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
    income,
    bankAccounts,
    isLoading,
    isMutating,
    refetch: load,
    create: (input: IncomeInput) =>
      mutate<{ income: IncomeEntry }>(() =>
        fetch("/api/income", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    update: (id: string, input: Partial<IncomeInput>) =>
      mutate<{ income: IncomeEntry }>(() =>
        fetch(`/api/income/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    remove: (id: string) => mutate<{ success: boolean }>(() => fetch(`/api/income/${id}`, { method: "DELETE" })),
  };
}
