import React from "react";

type Props = {
  status: "Pending" | "Partially Returned" | "Settled" | "Paid" | "Unpaid" | string;
  className?: string;
};

export default function StatusBadge({ status, className = "" }: Props) {
  const map: Record<string, string> = {
    Pending: "text-pending bg-pending-10",
    "Partially Returned": "text-blue-700 bg-blue-500/10 dark:text-blue-300",
    Settled: "text-settled bg-settled-10",
    Paid: "text-settled bg-settled-10",
    Unpaid: "text-expense bg-expense-10",
  };

  const classes = map[status] ?? "text-muted bg-muted/10";
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${classes} ${className}`}>
      {status}
    </span>
  );
}
