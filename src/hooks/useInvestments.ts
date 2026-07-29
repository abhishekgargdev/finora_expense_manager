"use client";

import * as React from "react";

export type InvestmentEntry = {
  id: string;
  type: string;
  name?: string;
  amountInvested: number;
  currentValue: number;
  date: string;
  note?: string;

  category?: "Market-Linked" | "Fixed-Tenure";
  investmentMode?: "Lumpsum" | "Recurring";
  institution?: string;
  planName?: string;
  accountOrPolicyNumber?: string;
  bankAccount?: string | null;
  expenseRef?: string | null;
  principalAmount?: number;
  installmentAmount?: number;
  installmentFrequency?: "Monthly" | "Quarterly";
  interestRate?: number;
  compoundingFrequency?: "Monthly" | "Quarterly" | "Half-Yearly" | "Annually" | "At Maturity";
  startDate?: string;
  tenureValue?: number;
  tenureUnit?: "Months" | "Years";
  maturityDate?: string;
  expectedMaturityAmount?: number;
  status?: "Active" | "Matured" | "Closed Prematurely";
  actualMaturityAmount?: number;
  actualClosureDate?: string;

  totalInstallments?: number;
  paidInstallments?: number;
};


export type ContributionEntry = {
  id: string;
  investment: string;
  dueDate: string;
  paidDate?: string | null;
  amount: number;
  status: "Paid" | "Pending" | "Missed";
  bankAccount?: string | null;
  expenseRef?: string | null;
  note?: string;
};

export type InvestmentInput = Partial<Omit<InvestmentEntry, "id">>;
export type InvestmentFilters = { month?: number; year?: number; type?: string; sort?: string };

async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}

export function useInvestments(filters: InvestmentFilters = {}) {
  const [investments, setInvestments] = React.useState<InvestmentEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);
  const { month, year, type, sort } = filters;

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries({ month, year, type, sort }).forEach(([key, value]) => {
        if (value !== undefined && value !== "") params.set(key, String(value));
      });
      setInvestments((await readJson(await fetch(`/api/investments?${params.toString()}`))).investments);
    } finally {
      setIsLoading(false);
    }
  }, [month, year, type, sort]);

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
    investments,
    isLoading,
    isMutating,
    refetch: load,
    create: (input: InvestmentInput) =>
      mutate<{ investment: InvestmentEntry }>(() =>
        fetch("/api/investments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    update: (id: string, input: Partial<InvestmentInput>) =>
      mutate<{ investment: InvestmentEntry }>(() =>
        fetch(`/api/investments/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    remove: (id: string) => mutate<{ success: boolean }>(() => fetch(`/api/investments/${id}`, { method: "DELETE" })),
    fetchContributions: async (investmentId: string) => {
      const response = await fetch(`/api/investments/${investmentId}/contributions`);
      return readJson(response) as Promise<{ contributions: ContributionEntry[] }>;
    },
    updateContribution: async (contributionId: string, input: Partial<Omit<ContributionEntry, "id">>) =>
      mutate<{ success: boolean; contribution: ContributionEntry; investment: any }>(() =>
        fetch(`/api/investments/contributions/${contributionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
  };
}

