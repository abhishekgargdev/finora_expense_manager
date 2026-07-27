import React from "react";

type Props = {
  value: number;
  currency?: string;
  variant?: "default" | "positive" | "negative";
  className?: string;
};

function formatNumber(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function MoneyText({ value, currency = "₹", variant = "default", className = "" }: Props) {
  const signClass = variant === "positive" ? "text-settled" : variant === "negative" ? "text-expense" : "";
  return (
    <span className={`money ${signClass} ${className}`}>
      {" "}
      {currency}
      {formatNumber(value)}
    </span>
  );
}
