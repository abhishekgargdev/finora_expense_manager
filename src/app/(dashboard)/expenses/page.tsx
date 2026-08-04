"use client";

import * as React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CalendarDays, CircleDollarSign, Pencil, Plus, ReceiptText, Trash2, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { Cell, Pie, PieChart, Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

import EmptyState from "@/components/finance/EmptyState";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import PageSkeleton from "@/components/loader/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import PaymentSourceSelect from "@/components/finance/PaymentSourceSelect";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import {
  expensePaymentAccountLabel,
  parsePaymentSource,
  paymentModeNeedsSource,
  resolvePaymentModeFromSource,
  toPaymentSource,
  type PaymentSourceValue,
} from "@/lib/payment-source";
import { type ExpenseEntry, type ExpenseInput, useExpenses } from "@/hooks/useExpenses";
import { useSearchParams } from "next/navigation";
import { useCategories } from "@/hooks/useCategories";
import { Pagination } from "@/components/ui/pagination";

const PAYMENT_MODES = ["Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer"] as const;
const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2024, index).toLocaleString("en", { month: "long" }));
const CHART_COLORS = ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#4b5563"];

type FormState = {
  amount: string;
  source: string;
  category: string;
  date: string;
  paymentMode: ExpenseInput["paymentMode"];
  paymentSource: PaymentSourceValue;
  note: string;
};
const emptyForm = (): FormState => ({
  amount: "",
  source: "",
  category: "Food",
  date: format(new Date(), "yyyy-MM-dd"),
  paymentMode: "UPI",
  paymentSource: "",
  note: "",
});
const toForm = (expense: ExpenseEntry): FormState => ({
  amount: String(expense.amount),
  source: expense.source ?? "",
  category: expense.category,
  date: format(new Date(expense.date), "yyyy-MM-dd"),
  paymentMode: expense.paymentMode,
  paymentSource: toPaymentSource(expense.bankAccount, expense.creditCard),
  note: expense.note ?? "",
});
const displayDate = (date: string) => format(new Date(date), "dd MMM yyyy");

export default function ExpensesPage() {
  const {
    expenses,
    bankAccounts,
    creditCards,
    isLoading: expensesLoading,
    isMutating,
    create,
    update,
    remove,
  } = useExpenses();
  const { expenseCategories: CATEGORIES, create: createCategory, isLoading: categoriesLoading } = useCategories();
  const isLoading = expensesLoading || categoriesLoading;

  const today = React.useMemo(() => new Date(), []);
  const [month, setMonth] = React.useState(String(today.getMonth() + 1));
  const [year, setYear] = React.useState(String(today.getFullYear()));
  const [category, setCategory] = React.useState("all");
  const [trendTab, setTrendTab] = React.useState<"monthly" | "yearly">("monthly");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<ExpenseEntry | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const [customCategory, setCustomCategory] = React.useState("");

  const searchParams = useSearchParams();

  const filtered = React.useMemo(
    () =>
      expenses.filter((expense) => {
        const date = new Date(expense.date);
        return (
          date.getMonth() + 1 === Number(month) &&
          date.getFullYear() === Number(year) &&
          (category === "all" || expense.category === category)
        );
      }),
    [expenses, month, year, category]
  );

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [month, year, category]);

  const paginatedExpenses = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);

  const paymentModeData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((item) => {
      counts[item.paymentMode] = (counts[item.paymentMode] || 0) + item.amount;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const paymentConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    PAYMENT_MODES.forEach((mode) => {
      cfg[mode.replace(/\s+/g, "_")] = { label: mode };
    });
    return cfg;
  }, []);

  const categoryChartData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filtered.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + item.amount;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const categoryConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    CATEGORIES.forEach((cat) => {
      cfg[cat.replace(/\s+/g, "_")] = { label: cat };
    });
    return cfg;
  }, [CATEGORIES]);

  // Monthly trends (last 12 months)
  const monthlyTrendData = React.useMemo(() => {
    const result = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const yearKey = d.getFullYear();
      const monthKey = d.getMonth() + 1;
      const label = d.toLocaleString("default", { month: "short", year: "2-digit" });
      
      const total = expenses
        .filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate.getMonth() + 1 === monthKey && entryDate.getFullYear() === yearKey;
        })
        .reduce((sum, entry) => sum + entry.amount, 0);
        
      result.push({
        name: label,
        expense: total,
      });
    }
    return result;
  }, [expenses]);

  // Yearly trends (all years)
  const yearlyTrendData = React.useMemo(() => {
    const result: Record<number, number> = {};
    expenses.forEach((entry) => {
      const y = new Date(entry.date).getFullYear();
      result[y] = (result[y] || 0) + entry.amount;
    });
    const yearsSet = new Set([today.getFullYear(), ...expenses.map((entry) => new Date(entry.date).getFullYear())]);
    return Array.from(yearsSet)
      .sort((a, b) => a - b)
      .map((y) => ({
        name: String(y),
        expense: result[y] || 0,
      }));
  }, [expenses, today]);

  const trendConfig = React.useMemo(() => ({
    expense: { label: "Expense", color: "var(--expense)" }
  }), []);

  const monthTotal = React.useMemo(
    () =>
      expenses
        .filter((expense) => {
          const date = new Date(expense.date);
          return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        })
        .reduce((total, expense) => total + expense.amount, 0),
    [expenses, today]
  );
  const yearTotal = React.useMemo(
    () =>
      expenses
        .filter((expense) => new Date(expense.date).getFullYear() === today.getFullYear())
        .reduce((total, expense) => total + expense.amount, 0),
    [expenses, today]
  );
  const averageMonthly = yearTotal / Math.max(today.getMonth() + 1, 1);
  const years = Array.from(
    new Set([today.getFullYear(), ...expenses.map((expense) => new Date(expense.date).getFullYear())])
  ).sort((a, b) => b - a);
  const showPaymentSource = paymentModeNeedsSource(form.paymentMode);

  React.useEffect(() => {
    if (searchParams.get("add") === "true") {
      startCreate();
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (!open) {
      setForm(emptyForm());
      setEditing(null);
      setCustomCategory("");
    }
  }, [open]);

  function startCreate() {
    setEditing(null);
    setForm(emptyForm());
    setCustomCategory("");
    setOpen(true);
  }
  function startEdit(expense: ExpenseEntry) {
    setEditing(expense);
    setForm(toForm(expense));
    setCustomCategory("");
    setOpen(true);
  }
  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "category" && value !== "Other") setCustomCategory("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter an amount greater than zero.");
    if (showPaymentSource && !form.paymentSource) {
      return toast.error("Choose a bank account or credit card.");
    }
    const { bankAccount, creditCard } = parsePaymentSource(form.paymentSource);

    let finalCategory = form.category;
    if (form.category === "Other" && customCategory.trim()) {
      const cleanCustom = customCategory.trim();
      try {
        await createCategory(cleanCustom, "Expense");
        finalCategory = cleanCustom;
      } catch (err) {
        return toast.error("Unable to create new category.");
      }
    }

    const payload: ExpenseInput = {
      amount,
      source: form.source.trim() || undefined,
      category: finalCategory,
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      paymentMode: form.paymentMode,
      bankAccount: showPaymentSource ? bankAccount : null,
      creditCard: showPaymentSource ? creditCard : null,
      note: form.note.trim() || undefined,
    };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Expense entry updated.");
      } else {
        await create(payload);
        toast.success("Expense entry added.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save expense.");
    }
  }

  const [expenseToDelete, setExpenseToDelete] = React.useState<ExpenseEntry | null>(null);
  async function deleteExpense() {
    if (!expenseToDelete) return;
    try {
      await remove(expenseToDelete.id);
      toast.success("Expense entry deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete expense.");
    }
  }

  if (isLoading) return <PageSkeleton variant="table" />;
  return (
    <motion.div
      className="space-y-6"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      <motion.div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center" variants={fadeInUp}>
        <div>
          <h2 className="font-heading text-2xl font-semibold">Expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">Keep a clear view of every outgoing payment.</p>
        </div>
        <Button onClick={startCreate} className="hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus />
          Add Expense
        </Button>
      </motion.div>
      <motion.div className="grid gap-4 md:grid-cols-3" variants={staggerContainer}>
        <motion.div variants={fadeInUp}>
          <StatCard icon={<TrendingDown />} label="Total Expense This Month" value={monthTotal} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard icon={<CircleDollarSign />} label="Total Expense This Year" value={yearTotal} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard icon={<CalendarDays />} label="Avg Monthly" value={averageMonthly} />
        </motion.div>
      </motion.div>

      {/* Expense Trends Chart Card */}
      <motion.div className="card p-5 hover:border-primary/20 hover:shadow-md transition-all duration-300" variants={fadeInUp}>
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-heading font-semibold">Expense Trends</h3>
            <p className="text-xs text-muted-foreground">Spending analysis over time</p>
          </div>
          <div className="flex rounded-lg bg-muted p-1 text-xs font-medium self-start sm:self-auto select-none">
            <button
              onClick={() => setTrendTab("monthly")}
              className={`rounded-md px-3 py-1.5 transition-all outline-none ${
                trendTab === "monthly"
                  ? "bg-background text-foreground shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly View (Last 12M)
            </button>
            <button
              onClick={() => setTrendTab("yearly")}
              className={`rounded-md px-3 py-1.5 transition-all outline-none ${
                trendTab === "yearly"
                  ? "bg-background text-foreground shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly View
            </button>
          </div>
        </div>
        <div className="mt-4">
          <ChartContainer config={trendConfig} className="h-64 w-full aspect-auto">
            <BarChart data={trendTab === "monthly" ? monthlyTrendData : yearlyTrendData}>
              <XAxis dataKey="name" />
              <YAxis />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="expense" fill="var(--expense)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </motion.div>

      <motion.div className="flex flex-col gap-3 sm:flex-row" variants={fadeInUp}>
        <Select value={month} onValueChange={(value) => setMonth(value ?? String(today.getMonth() + 1))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>{MONTHS[Number(month) - 1]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year} onValueChange={(value) => setYear(value ?? String(today.getFullYear()))}>
          <SelectTrigger className="w-full sm:w-28">
            <SelectValue>{year}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {years.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(value) => setCategory(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>{category === "all" ? "All categories" : category}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </motion.div>
      {filtered.length === 0 ? (
        <motion.div variants={fadeInUp}>
          <EmptyState
            icon={<ReceiptText />}
            title="No expense entries yet"
            description="Add your first expense to start understanding where money goes."
            action={
              <Button onClick={startCreate} className="hover:scale-[1.02] active:scale-[0.98] transition-all">
                <Plus />
                Add your first expense
              </Button>
            }
          />
        </motion.div>
      ) : (
        <motion.div className="grid gap-6 lg:grid-cols-[2.2fr_1fr] items-start" variants={fadeInUp}>
          <div className="space-y-4">
            <div className="card hidden md:block">
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Payment mode</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedExpenses.map((expense) => (
                      <TableRow key={expense.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell>
                          <div className="font-medium">{expense.source || expense.category}</div>
                          {expense.note && (
                            <div className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">{expense.note}</div>
                          )}
                        </TableCell>
                        <TableCell>{expense.category}</TableCell>
                        <TableCell>{displayDate(expense.date)}</TableCell>
                        <TableCell>
                          <div>{expense.paymentMode}</div>
                          {(() => {
                            const accountLabel = expensePaymentAccountLabel(expense, bankAccounts, creditCards);
                            return accountLabel ? (
                              <div className="mt-0.5 text-xs text-muted-foreground">{accountLabel}</div>
                            ) : null;
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          <MoneyText value={expense.amount} variant="negative" />
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => startEdit(expense)}
                                    aria-label="Edit expense"
                                  />
                                }
                              >
                                <Pencil />
                              </TooltipTrigger>
                              <TooltipContent>Edit expense</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger
                                render={
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-destructive hover:text-destructive"
                                    onClick={() => setExpenseToDelete(expense)}
                                    aria-label="Delete expense"
                                  />
                                }
                              >
                                <Trash2 />
                              </TooltipTrigger>
                              <TooltipContent>Delete expense</TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="grid gap-3 md:hidden">
              {paginatedExpenses.map((expense) => (
                <article key={expense.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{expense.source || expense.category}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {expense.category} · {displayDate(expense.date)}
                      </p>
                    </div>
                    <MoneyText value={expense.amount} variant="negative" className="font-semibold" />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                    <div>
                      <div>{expense.paymentMode}</div>
                      {(() => {
                        const accountLabel = expensePaymentAccountLabel(expense, bankAccounts, creditCards);
                        return accountLabel ? <div className="text-xs">{accountLabel}</div> : null;
                      })()}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => startEdit(expense)} aria-label="Edit expense">
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setExpenseToDelete(expense)}
                        aria-label="Delete expense"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filtered.length}
              itemsPerPage={ITEMS_PER_PAGE}
              className="mt-4"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {paymentModeData.length > 0 && (
              <div className="card p-5">
                <div>
                  <h3 className="font-heading text-sm font-semibold">Payment Mode Share</h3>
                  <p className="text-xs text-muted-foreground">Spending share by mode</p>
                </div>
                <div className="flex justify-center mt-3">
                  <ChartContainer config={paymentConfig} className="h-36 w-full aspect-square max-w-[150px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie data={paymentModeData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="70%">
                        {paymentModeData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>
              </div>
            )}

            {categoryChartData.length > 0 && (
              <div className="card p-5">
                <div>
                  <h3 className="font-heading text-sm font-semibold">Category Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Spending share by categories</p>
                </div>
                <div className="flex justify-center mt-3">
                  <ChartContainer config={categoryConfig} className="h-36 w-full aspect-square max-w-[150px]">
                    <PieChart>
                      <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                      <Pie data={categoryChartData} dataKey="value" nameKey="name" innerRadius="45%" outerRadius="70%">
                        {categoryChartData.map((_, index) => (
                          <Cell key={index} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit expense" : "Add expense"}</DialogTitle>
            <DialogDescription>Record an outgoing payment and its source account.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="expense-amount">Amount</Label>
                <Input
                  id="expense-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateForm("amount", event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expense-source">
                  Source <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="expense-source"
                  value={form.source}
                  onChange={(event) => updateForm("source", event.target.value)}
                  placeholder="Store, merchant, payee..."
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(value) => updateForm("category", value ?? "Other")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{form.category}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                    <CalendarDays />
                    {format(new Date(`${form.date}T12:00:00`), "dd MMM yyyy")}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={new Date(`${form.date}T12:00:00`)}
                      onSelect={(date) => date && updateForm("date", format(date, "yyyy-MM-dd"))}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            {form.category === "Other" && (
              <div className="grid gap-2">
                <Label htmlFor="custom-category">Custom Category Name</Label>
                <Input
                  id="custom-category"
                  value={customCategory}
                  onChange={(event) => setCustomCategory(event.target.value)}
                  placeholder="e.g. Gym, Subscriptions"
                  required
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Payment mode</Label>
              <Select
                value={form.paymentMode}
                onValueChange={(value) => {
                  const mode = (value ?? "Cash") as ExpenseInput["paymentMode"];
                  setForm((current) => ({
                    ...current,
                    paymentMode: mode,
                    paymentSource: mode === "Cash" ? "" : current.paymentSource,
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{form.paymentMode}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_MODES.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {showPaymentSource && (
              <PaymentSourceSelect
                value={form.paymentSource}
                onValueChange={(paymentSource) =>
                  setForm((current) => ({
                    ...current,
                    paymentSource,
                    paymentMode: resolvePaymentModeFromSource(paymentSource, current.paymentMode),
                  }))
                }
                bankAccounts={bankAccounts}
                creditCards={creditCards}
                label="Payment source"
                placeholder="Choose bank account or credit card"
              />
            )}
            <div className="grid gap-2">
              <Label htmlFor="expense-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="expense-note"
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                placeholder="Add context for this expense"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Add expense"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!expenseToDelete}
        onOpenChange={(open) => !open && setExpenseToDelete(null)}
        title="Delete Expense Entry?"
        description={`Are you sure you want to delete this ${expenseToDelete?.category.toLowerCase()} expense? This will permanently remove it from your records and refund any associated bank account or card balance.`}
        onConfirm={deleteExpense}
      />
      <LoaderOverlay show={isMutating} label={editing ? "Saving expense..." : "Updating expenses..."} />
    </motion.div>
  );
}
