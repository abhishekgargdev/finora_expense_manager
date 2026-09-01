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
  accent?: "primary" | "secondary" | "rose" | "emerald" | "indigo" | "blue" | "amber" | string;
  subtitle?: string;
};

export default function StatCard({
  icon,
  label,
  value,
  currency = "₹",
  trend,
  accent = "primary",
  subtitle,
}: Props) {
  const count = useCountUp(value, 900);

  const getAccentStyles = () => {
    switch (accent) {
      case "rose":
        return {
          cardBorder: "border-rose-500/25 hover:border-rose-500/50 hover:shadow-rose-500/10",
          iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-1 ring-rose-500/20",
          accentColor: "text-rose-600 dark:text-rose-400",
        };
      case "emerald":
        return {
          cardBorder: "border-emerald-500/25 hover:border-emerald-500/50 hover:shadow-emerald-500/10",
          iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/20",
          accentColor: "text-emerald-600 dark:text-emerald-400",
        };
      case "indigo":
        return {
          cardBorder: "border-indigo-500/25 hover:border-indigo-500/50 hover:shadow-indigo-500/10",
          iconBg: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-1 ring-indigo-500/20",
          accentColor: "text-indigo-600 dark:text-indigo-400",
        };
      case "blue":
        return {
          cardBorder: "border-blue-500/25 hover:border-blue-500/50 hover:shadow-blue-500/10",
          iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500/20",
          accentColor: "text-blue-600 dark:text-blue-400",
        };
      case "amber":
        return {
          cardBorder: "border-amber-500/25 hover:border-amber-500/50 hover:shadow-amber-500/10",
          iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-1 ring-amber-500/20",
          accentColor: "text-amber-600 dark:text-amber-400",
        };
      default:
        return {
          cardBorder: "border-border/80 hover:border-primary/40 hover:shadow-primary/5",
          iconBg: "bg-primary/10 text-primary ring-1 ring-primary/20",
          accentColor: "text-foreground",
        };
    }
  };

  const { cardBorder, iconBg, accentColor } = getAccentStyles();

  return (
    <motion.div
      className={`card p-4 rounded-xl border ${cardBorder} shadow-xs hover:shadow-md transition-all duration-300 select-none flex flex-col justify-between min-h-[105px]`}
      variants={fadeInUp}
      initial="hidden"
      animate="show"
      whileHover={{ y: -3, scale: 1.01 }}
    >
      <div className="flex items-center gap-3">
        {icon && (
          <div className={`shrink-0 size-10 flex items-center justify-center rounded-xl ${iconBg} shadow-xs transition-transform duration-300`}>
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold text-muted-foreground truncate uppercase tracking-wider">
            {label}
          </div>
          {subtitle && <div className="text-[10px] text-muted-foreground/75 truncate mt-0.5">{subtitle}</div>}
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className={`text-xl sm:text-2xl font-bold font-heading tabular-nums tracking-tight ${accentColor}`}>
          <MoneyText value={count} currency={currency} className="text-xl sm:text-2xl font-bold" />
        </div>
        {trend && (
          <div className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${trend.direction === "up" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/10 text-rose-600 dark:text-rose-400"}`}>
            <span>{trend.direction === "up" ? "▲" : "▼"}</span>
            <span>{Math.abs(trend.percent)}%</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
