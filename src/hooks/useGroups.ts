"use client";
import * as React from "react";

export type Group = {
  id: string;
  name: string;
  description?: string;
  members: string[];
  totalExpense?: number;
  userBalance?: number;
};

export type GroupSplit = {
  member: string;
  amount: number;
};

export type GroupExpense = {
  id: string;
  description: string;
  amount: number;
  paidBy: string;
  date: string;
  isSettlement: boolean;
  splits: GroupSplit[];
};

export type GroupDetail = {
  group: Group;
  expenses: GroupExpense[];
  balances: Record<string, number>;
  suggestedSettlements: { from: string; to: string; amount: number }[];
  totalSpending: number;
};

async function json(response: Response | Promise<Response>) {
  const result = await response;
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}

export function useGroups() {
  const [groups, setGroups] = React.useState<Group[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mutating, setMutating] = React.useState(false);

  const loadGroups = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await json(fetch("/api/groups"));
      setGroups(data.groups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void (async () => {
      await Promise.resolve();
      await loadGroups();
    })();
  }, [loadGroups]);

  const mutate = React.useCallback(
    async <T>(call: () => Promise<Response>) => {
      setMutating(true);
      try {
        const value = await json(call());
        await loadGroups();
        return value as T;
      } finally {
        setMutating(false);
      }
    },
    [loadGroups]
  );

  return {
    groups,
    loading,
    mutating,
    loadGroups,
    createGroup: (input: { name: string; description?: string; members: string[] }) =>
      mutate<{ group: Group }>(() =>
        fetch("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
    fetchGroup: async (id: string): Promise<GroupDetail> => {
      return json(fetch(`/api/groups/${id}`));
    },
    deleteGroup: (id: string) =>
      mutate<void>(() =>
        fetch(`/api/groups/${id}`, {
          method: "DELETE",
        })
      ),
    addExpense: (
      groupId: string,
      input: {
        description: string;
        amount: number;
        paidBy: string;
        date: string;
        splits: GroupSplit[];
        isSettlement?: boolean;
        paymentMode?: string;
        bankAccountId?: string;
        creditCardId?: string;
      }
    ) =>
      mutate<{ expense: GroupExpense }>(() =>
        fetch(`/api/groups/${groupId}/expenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        })
      ),
  };
}
