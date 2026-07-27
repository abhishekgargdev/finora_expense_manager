"use client";
import * as React from "react";
export type CreditCard = {
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
export type CardTransaction = {
  id: string;
  amount: number;
  description?: string;
  date: string;
  billed: boolean;
  billingMonth?: string;
};
export type CardBill = {
  id: string;
  billingMonth: string;
  totalAmount: number;
  dueDate: string;
  isPaid: boolean;
  paidDate?: string | null;
  paidAmount?: number;
};
export type BankAccount = { id: string; name: string; last4Digits?: string };
export type CardInput = Omit<CreditCard, "id" | "outstanding" | "availableCredit">;
async function json(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}
export function useCreditCards() {
  const [cards, setCards] = React.useState<CreditCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mutating, setMutating] = React.useState(false);
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setCards((await json(await fetch("/api/credit-cards"))).cards);
    } finally {
      setLoading(false);
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
      setMutating(true);
      try {
        const data = await json(await call());
        await load();
        return data as T;
      } finally {
        setMutating(false);
      }
    },
    [load]
  );
  return {
    cards,
    loading,
    mutating,
    create: (input: CardInput) =>
      mutate(() =>
        fetch("/api/credit-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    remove: (id: string) => mutate(() => fetch(`/api/credit-cards/${id}`, { method: "DELETE" })),
    generateBill: (id: string) =>
      mutate(() =>
        fetch(`/api/credit-cards/${id}/bills`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        })
      ),
  };
}
