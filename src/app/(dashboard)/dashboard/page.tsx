"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { staggerContainer, fadeInUp, scaleIn } from "@/lib/motion";
import { Cell, Bar, BarChart, Line, LineChart, Pie, PieChart, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  PiggyBank,
  Plus,
  ReceiptText,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
import PageSkeleton from "@/components/loader/PageSkeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import QuickAddDialog from "@/components/dashboard/QuickAddDialog";
import SyncReminderBanner from "@/components/integrations/SyncReminderBanner";
import { cn } from "@/lib/utils";
type Summary = any;
const colors = ["var(--income)", "var(--expense)", "var(--investment)", "var(--primary)", "var(--pending)", "#8b5cf6"];
const config = {
  income: { label: "Income", color: "var(--income)" },
  expense: { label: "Expense", color: "var(--expense)" },
  investment: { label: "Investment", color: "var(--investment)" },
  lendingGiven: { label: "Lent (Given)", color: "var(--pending)" },
  lendingTaken: { label: "Borrowed (Taken)", color: "#14b8a6" },
} satisfies ChartConfig;
export default function DashboardPage() {
  const [data, setData] = React.useState<Summary | null>(null);
  const [month, setMonth] = React.useState("all");
  const [year, setYear] = React.useState(String(new Date().getFullYear()));
  const [quickAddOpen, setQuickAddOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [timeframe, setTimeframe] = React.useState<"monthly" | "yearly">("monthly");
  React.useEffect(() => {
    void (async () => {
      const params = new URLSearchParams(month === "all" ? {} : { month, year });
      const response = await fetch(`/api/dashboard/summary?${params}`);
      if (response.ok) setData(await response.json());
    })();
  }, [month, year, refreshTrigger]);
  const liquidAssetsData = React.useMemo(() => {
    if (!data) return [];
    const list = data.accounts.map((acc: any) => ({
      name: acc.name || acc.bankName,
      value: acc.currentBalance,
      color: acc.themeColor || "#1e3a5f",
    }));
    if (data.cashBalance > 0) {
      list.push({
        name: "Cash Wallet",
        value: data.cashBalance,
        color: "#0f766e",
      });
    }
    return list;
  }, [data]);

  const liquidConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    liquidAssetsData.forEach((item: any) => {
      cfg[item.name.replace(/\s+/g, "_")] = { label: item.name, color: item.color };
    });
    return cfg;
  }, [liquidAssetsData]);

  if (!data) return <PageSkeleton variant="chart" />;
  const distribution = Object.entries(data.investments.distribution).map(([name, value]) => ({ name, value }));
  const lowBalanceAccounts = data.accounts.filter(
    (acc: any) => acc.minimumBalance !== undefined && acc.currentBalance < acc.minimumBalance
  );

  const cards = [
    [<Landmark />, "Total Bank Balance", data.bankBalance],
    [<Banknote />, "Cash Balance", data.cashBalance],
    [<ArrowUpRight />, "Total Income", data.period.income],
    [<ArrowDownRight />, "Total Expense", data.period.expense],
    [<PiggyBank />, "Net Savings", data.period.netSavings],
    [<TrendingUp />, "Total Investments", data.investments.value],
    [<HandCoins />, "Pending to Receive", data.lending.pendingGiven],
    [<CreditCard />, "Credit Card Outstanding", data.creditOutstanding],
  ] as const;
  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <SyncReminderBanner />

      <motion.div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end" variants={fadeInUp}>
        <div>
          <h2 className="font-heading text-2xl font-semibold">Financial overview</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your money, spending, and financial position at a glance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setQuickAddOpen(true)} className="hover:scale-[1.02] active:scale-[0.98] transition-all">
            <Plus className="size-4" />
            Quick Add
          </Button>
          <Select value={month} onValueChange={(value) => setMonth(value ?? "all")}>
            <SelectTrigger className="w-32">
              <SelectValue>
                {month === "all"
                  ? "All time"
                  : new Date(2026, Number(month) - 1, 1).toLocaleString("default", { month: "short" })}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              {Array.from({ length: 12 }, (_, index) => (
                <SelectItem key={index + 1} value={String(index + 1)}>
                  {new Date(2026, index, 1).toLocaleString("default", { month: "short" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={(value) => setYear(value ?? String(new Date().getFullYear()))}>
            <SelectTrigger className="w-24">
              <SelectValue>{year}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {[0, 1, 2].map((offset) => (
                <SelectItem key={offset} value={String(new Date().getFullYear() - offset)}>
                  {new Date().getFullYear() - offset}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {lowBalanceAccounts.length > 0 && (
        <motion.div
          className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-4 flex gap-3 items-start"
          variants={fadeInUp}
        >
          <span className="flex p-2 bg-destructive/15 text-destructive rounded-lg shrink-0 animate-pulse">
            <AlertTriangle className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="font-heading text-sm font-semibold text-destructive">Low Balance Alert</h4>
            <p className="text-xs mt-0.5 text-muted-foreground">
              The following account{lowBalanceAccounts.length > 1 ? "s are" : " is"} below the set minimum limit:
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold">
              {lowBalanceAccounts.map((acc: any) => (
                <li key={acc.id} className="flex flex-wrap items-center gap-1.5 text-foreground/90">
                  <span className="text-destructive">•</span>
                  <span>{acc.name}:</span>
                  <span className="text-destructive font-bold">
                    <MoneyText value={acc.currentBalance} />
                  </span>
                  <span className="text-muted-foreground font-normal text-[10px]">
                    (Minimum limit: <MoneyText value={acc.minimumBalance} />)
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      )}

      <motion.div className="card p-4 hover:border-primary/20 hover:shadow-md transition-all duration-300" variants={fadeInUp}>
        <h3 className="font-heading text-sm font-semibold mb-3">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/expenses?add=true"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-expense-10 text-expense border border-expense/25 hover:bg-expense/10 rounded-lg text-sm font-medium hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="size-4" /> Add Expense
          </Link>
          <Link
            href="/income?add=true"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-income-10 text-income border border-income/25 hover:bg-income/10 rounded-lg text-sm font-medium hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="size-4" /> Add Income
          </Link>
          <Link
            href="/investments?add=true"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-investment-10 text-investment border border-investment/25 hover:bg-investment/10 rounded-lg text-sm font-medium hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="size-4" /> Add Investment
          </Link>
          <Link
            href="/lending?add=true"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-pending-10 text-pending border border-pending/25 hover:bg-pending/10 rounded-lg text-sm font-medium hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <Plus className="size-4" /> Add Lending
          </Link>
        </div>
      </motion.div>

      <motion.div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" variants={staggerContainer}>
        {cards.map(([icon, label, value]) => (
          <StatCard key={label} icon={icon} label={label} value={value} />
        ))}
      </motion.div>

      <motion.div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]" variants={fadeInUp}>
        <section className="card p-5 hover:border-primary/20 hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-heading font-semibold">Cashflow Allocation</h3>
              <p className="text-sm text-muted-foreground">
                {timeframe === "monthly" ? "Monthly allocation" : "Yearly allocation"}
              </p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 text-xs font-medium">
              <button
                onClick={() => setTimeframe("monthly")}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-all text-center select-none outline-none cursor-pointer",
                  timeframe === "monthly"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                )}
              >
                Monthly
              </button>
              <button
                onClick={() => setTimeframe("yearly")}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-all text-center select-none outline-none cursor-pointer",
                  timeframe === "yearly"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
                )}
              >
                Yearly
              </button>
            </div>
          </div>
          <ChartContainer config={config} className="mt-4 h-72 w-full aspect-auto">
            <BarChart
              data={timeframe === "monthly" ? data.monthlyTrend : data.yearlyTrend}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <XAxis
                dataKey={timeframe === "monthly" ? "month" : "year"}
                tickFormatter={
                  timeframe === "monthly"
                    ? (val) => {
                        const [y, m] = val.split("-");
                        const d = new Date(Number(y), Number(m) - 1, 1);
                        return d.toLocaleString("default", { month: "short" }) + " '" + y.slice(2);
                      }
                    : undefined
                }
                stroke="var(--muted-foreground)"
                fontSize={11}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickFormatter={(val) => `₹${val >= 1000 ? (val / 1000).toFixed(0) + "k" : val}`}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} name="Income" />
              <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} name="Expense" />
              <Bar dataKey="investment" fill="var(--color-investment)" radius={[4, 4, 0, 0]} name="Investment" />
              <Bar dataKey="lendingGiven" fill="var(--color-lendingGiven)" radius={[4, 4, 0, 0]} name="Lent" />
              <Bar dataKey="lendingTaken" fill="var(--color-lendingTaken)" radius={[4, 4, 0, 0]} name="Borrowed" />
            </BarChart>
          </ChartContainer>
        </section>
        <section className="card p-5 hover:border-primary/20 hover:shadow-md transition-all duration-300">
          <h3 className="font-heading font-semibold">Expense by category</h3>
          <ChartContainer config={config} className="mt-4 h-72 w-full aspect-auto">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
              <Pie data={data.expenseCategories} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="82%">
                {data.expenseCategories.map((_: unknown, index: number) => (
                  <Cell key={index} fill={colors[index % colors.length]} />
                ))}
              </Pie>
            </PieChart>
          </ChartContainer>
        </section>
      </motion.div>

      <motion.div className="grid gap-5 lg:grid-cols-3" variants={fadeInUp}>
        <section className="card p-5 lg:col-span-2 hover:border-primary/20 hover:shadow-md transition-all duration-300">
          <h3 className="font-heading font-semibold">Investment distribution</h3>
          <ChartContainer config={config} className="mt-4 h-64 w-full aspect-auto">
            <BarChart data={distribution}>
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" fill="var(--investment)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </section>
        <section className="card p-5 flex flex-col justify-between hover:border-primary/20 hover:shadow-md transition-all duration-300">
          <div>
            <h3 className="font-heading font-semibold">Bank balances</h3>
            <p className="text-xs text-muted-foreground">Liquid asset distribution</p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 items-center">
            <div className="grid gap-2">
              {data.accounts.map((account: any) => (
                <div
                  key={account.id}
                  className="rounded-xl p-2.5 text-white transition-all hover:scale-[1.02] cursor-pointer hover:shadow-md"
                  style={{ background: `linear-gradient(135deg, ${account.themeColor || "#1e3a5f"}, #111827)` }}
                >
                  <div className="text-[10px] text-white/70">
                    {account.bankName} · •••• {account.last4Digits || "----"}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold truncate">{account.name}</div>
                  <MoneyText value={account.currentBalance} className="mt-0.5 text-base font-bold text-white" />
                </div>
              ))}
              {data.cashBalance > 0 && (
                <div
                  className="rounded-xl p-2.5 text-white transition-all hover:scale-[1.02] cursor-pointer hover:shadow-md"
                  style={{ background: "linear-gradient(135deg, #0f766e, #111827)" }}
                >
                  <div className="text-[10px] text-white/70">Physical Wallet</div>
                  <div className="mt-0.5 text-xs font-semibold">Cash</div>
                  <MoneyText value={data.cashBalance} className="mt-0.5 text-base font-bold text-white" />
                </div>
              )}
            </div>
            <div className="flex justify-center">
              <ChartContainer config={liquidConfig} className="h-32 w-full max-w-[130px] aspect-square">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={liquidAssetsData} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="75%">
                    {liquidAssetsData.map((asset: any, index: number) => (
                      <Cell key={index} fill={asset.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          </div>
        </section>
      </motion.div>

      <motion.div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3" variants={fadeInUp}>
        <People title="People who owe me" items={data.lending.owedToMe} />
        <People title="People I owe" items={data.lending.iOwe} />
        <section className="card p-5 hover:border-primary/20 hover:shadow-md transition-all duration-300">
          <h3 className="font-heading font-semibold">Recent transactions</h3>
          <div className="mt-3 space-y-3">
            {data.recent.map((item: any, index: number) => (
              <div key={index} className="flex items-center gap-3 hover:bg-muted/50 p-1.5 rounded-lg transition-colors cursor-pointer">
                <span
                  className={`flex size-8 items-center justify-center rounded-full ${item.type === "Income" ? "bg-income-10 text-income" : item.type === "Expense" ? "bg-expense-10 text-expense" : "bg-primary/10 text-primary"}`}
                >
                  {item.type === "Income" ? <ArrowUpRight className="size-4" /> : <ReceiptText className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="text-xs text-muted-foreground">{item.type}</div>
                </div>
                <MoneyText value={item.amount} variant={item.type === "Income" ? "positive" : "negative"} />
              </div>
            ))}
          </div>
        </section>
      </motion.div>
      <QuickAddDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        onSuccess={() => setRefreshTrigger((prev) => prev + 1)}
      />
    </motion.div>
  );
}
function People({ title, items }: { title: string; items: { person: string; pending: number }[] }) {
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-heading font-semibold">{title}</h3>
        <Link href="/lending" className="text-xs text-primary hover:underline">
          View all
        </Link>
      </div>
      <div className="mt-3 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.person} className="flex items-center justify-between">
              <span className="text-sm font-medium">{item.person}</span>
              <MoneyText value={item.pending} />
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">Nothing pending.</p>
        )}
      </div>
    </section>
  );
}
