"use client";

import * as React from "react";

export type CategoryEntry = { id: string; name: string; type: "Expense" | "Income" };

async function readJson(response: Response) {
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}

export function useCategories() {
  const [categories, setCategories] = React.useState<CategoryEntry[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isMutating, setIsMutating] = React.useState(false);

  const load = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/categories");
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories);
      }
    } catch (err) {
      console.error("Failed to load categories", err);
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
        const payload = await readJson(await request());
        await load();
        return payload as T;
      } finally {
        setIsMutating(false);
      }
    },
    [load]
  );

  const expenseCategories = React.useMemo(() => {
    return categories.filter((c) => c.type === "Expense").map((c) => c.name);
  }, [categories]);

  const incomeCategories = React.useMemo(() => {
    return categories.filter((c) => c.type === "Income").map((c) => c.name);
  }, [categories]);

  return {
    categories,
    expenseCategories,
    incomeCategories,
    isLoading,
    isMutating,
    refetch: load,
    create: (name: string, type: "Expense" | "Income") =>
      mutate<{ category: CategoryEntry }>(() =>
        fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, type }),
        })
      ),
    update: (id: string, name: string) =>
      mutate<{ category: CategoryEntry }>(() =>
        fetch(`/api/categories/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        })
      ),
    remove: (id: string) =>
      mutate<{ success: boolean }>(() =>
        fetch(`/api/categories/${id}`, {
          method: "DELETE",
        })
      ),
  };
}
