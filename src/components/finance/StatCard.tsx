import React from "react";
import { motion } from "framer-motion";
import MoneyText from "./MoneyText";
import useCountUp from "../../hooks/useCountUp";
import { fadeInUp } from "../../lib/motion";

type Trend = { percent: number; direction: "up" | "down" };

type Props = {
  icon?: React.ReactNode;
  label: string;
  value: number;
  currency?: string;
  trend?: Trend;
  accent?: "primary" | "secondary" | string;
};

export default function StatCard({ icon, label, value, currency = "₹", trend, accent = "primary" }: Props) {
  const count = useCountUp(value, 900);

  const accentClass = accent === "primary" ? "text-primary" : accent === "secondary" ? "text-secondary" : "";

  return (
    <motion.div className="card p-4" variants={fadeInUp} initial="hidden" animate="show">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 flex items-center justify-center rounded-lg bg-primary/6 text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 flex items-baseline gap-3">
            <div className="text-2xl font-semibold tabular-nums">
              <MoneyText value={count} currency={currency} className="text-2xl" />
            </div>
            {trend && (
              <div className={`text-sm font-medium ${trend.direction === "up" ? "text-settled" : "text-expense"}`}>
                {trend.direction === "up" ? "▲" : "▼"} {Math.abs(trend.percent)}%
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
