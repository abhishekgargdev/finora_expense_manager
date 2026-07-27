"use client";
import { useEffect, useState } from "react";

type User = { name: string; email: string } | null;

export default function useUser() {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const json = await res.json();
        if (!mounted) return;
        setUser(json.user ?? null);
      } catch (err) {
        setUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { user, loading };
}
