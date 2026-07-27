'use client';

import { useCallback, useEffect, useState } from 'react';

export type AsyncState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
};

/**
 * Example usage:
 * const { data, error, loading, execute } = useAsync(() => fetchData(), true);
 * if (loading) return <PageSkeleton variant="table" />;
 * if (error) return <div>Error loading data</div>;
 * return <DataTable items={data} />;
 */

export default function useAsync<T>(asyncFunction: () => Promise<T>, immediate = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await asyncFunction();
      setData(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Request failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (!immediate) return;
    execute().catch(() => {
      /* already handled by state */
    });
  }, [execute, immediate]);

  return { data, error, loading, execute };
}
