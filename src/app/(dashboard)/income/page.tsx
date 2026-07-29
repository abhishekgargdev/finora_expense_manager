"use client";

import * as React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CalendarDays, CircleDollarSign, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Cell, Pie, PieChart } from "recharts";
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
import { staggerContainer } from "@/lib/motion";
import { type IncomeEntry, type IncomeInput, useIncome } from "@/hooks/useIncome";
import { useSearchParams } from "next/navigation";
import { useCategories } from "@/hooks/useCategories";

const PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Other"] as const;
const CHART_COLORS = ["#0f766e", "#2563eb", "#d97706", "#dc2626", "#7c3aed", "#db2777", "#4b5563"];
const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Date(2024, index).toLocaleString("en", { month: "long" })
);

type FormState = {
  amount: string;
  source: string;
  category: string;
  date: string;
  paymentMode: IncomeInput["paymentMode"];
  bankAccount: string;
  note: string;
};

function newForm(): FormState {
  return {
    amount: "",
    source: "",
    category: "Salary",
    date: format(new Date(), "yyyy-MM-dd"),
    paymentMode: "Bank Transfer",
    bankAccount: "",
    note: "",
  };
}

function toForm(entry: IncomeEntry): FormState {
  return {
    amount: String(entry.amount),
    source: entry.source,
    category: entry.category ?? "Other",
    date: format(new Date(entry.date), "yyyy-MM-dd"),
    paymentMode: entry.paymentMode,
    bankAccount: entry.bankAccount ?? "",
    note: entry.note ?? "",
  };
}

function formatDate(value: string) {
  return format(new Date(value), "dd MMM yyyy");
}

export default function IncomePage() {
  const { income, bankAccounts, isLoading: incomeLoading, isMutating, create, update, remove } = useIncome();
  const { incomeCategories: CATEGORIES, create: createCategory, isLoading: categoriesLoading } = useCategories();
  const isLoading = incomeLoading || categoriesLoading;

  const today = React.useMemo(() => new Date(), []);
  const [month, setMonth] = React.useState(String(today.getMonth() + 1));
  const [year, setYear] = React.useState(String(today.getFullYear()));
  const [category, setCategory] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<IncomeEntry | null>(null);
  const [form, setForm] = React.useState<FormState>(newForm);
  const [customCategory, setCustomCategory] = React.useState("");

  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (searchParams.get("add") === "true") {
      openCreate();
    }
  }, [searchParams]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "category" && value !== "Other") {
      setCustomCategory("");
    }
  }

  const filteredIncome = React.useMemo(
    () =>
      income.filter((entry) => {
        const date = new Date(entry.date);
        return (
          date.getMonth() + 1 === Number(month) &&
          date.getFullYear() === Number(year) &&
          (category === "all" || entry.category === category)
        );
      }),
    [income, month, year, category]
  );

  const paymentModeData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIncome.forEach((item) => {
      counts[item.paymentMode] = (counts[item.paymentMode] || 0) + item.amount;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredIncome]);

  const paymentConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    PAYMENT_MODES.forEach((mode) => {
      cfg[mode.replace(/\s+/g, "_")] = { label: mode };
    });
    return cfg;
  }, []);

  const categoryChartData = React.useMemo(() => {
    const counts: Record<string, number> = {};
    filteredIncome.forEach((item) => {
      const cat = item.category || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + item.amount;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredIncome]);

  const categoryConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    CATEGORIES.forEach((cat) => {
      cfg[cat.replace(/\s+/g, "_")] = { label: cat };
    });
    return cfg;
  }, [CATEGORIES]);

  const monthlyTotal = React.useMemo(
    () =>
      income
        .filter((entry) => {
          const date = new Date(entry.date);
          return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
        })
        .reduce((sum, entry) => sum + entry.amount, 0),
    [income, today]
  );
  const yearlyIncome = React.useMemo(
    () => income.filter((entry) => new Date(entry.date).getFullYear() === today.getFullYear()),
    [income, today]
  );
  const yearlyTotal = yearlyIncome.reduce((sum, entry) => sum + entry.amount, 0);
  const avgMonthly = yearlyTotal / Math.max(today.getMonth() + 1, 1);
  const years = Array.from(
    new Set([today.getFullYear(), ...income.map((entry) => new Date(entry.date).getFullYear())])
  ).sort((a, b) => b - a);

  function openCreate() {
    setEditing(null);
    setForm(newForm());
    setCustomCategory("");
    setDialogOpen(true);
  }

  function openEdit(entry: IncomeEntry) {
    setEditing(entry);
    setForm(toForm(entry));
    setCustomCategory("");
    setDialogOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0 || !form.source.trim()) {
      toast.error("Enter a source and an amount greater than zero.");
      return;
    }

    let finalCategory = form.category;
    if (form.category === "Other" && customCategory.trim()) {
      const cleanCustom = customCategory.trim();
      try {
        await createCategory(cleanCustom, "Income");
        finalCategory = cleanCustom;
      } catch (err) {
        return toast.error("Unable to create new category.");
      }
    }

    const payload: IncomeInput = {
      ...form,
      amount,
      source: form.source.trim(),
      category: finalCategory || undefined,
      note: form.note.trim() || undefined,
      bankAccount: form.bankAccount || null,
      date: new Date(`${form.date}T12:00:00`).toISOString(),
    };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Income entry updated.");
      } else {
        await create(payload);
        toast.success("Income entry added.");
      }
      setDialogOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save income.");
    }
  }

  const [incomeToDelete, setIncomeToDelete] = React.useState<IncomeEntry | null>(null);
  async function deleteIncome() {
    if (!incomeToDelete) return;
    try {
      await remove(incomeToDelete.id);
      toast.success("Income entry deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete income.");
    }
  }

  if (isLoading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Income</h2>
          <p className="mt-1 text-sm text-muted-foreground">Track every payment that adds to your finances.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add Income
        </Button>
      </div>

      <motion.div className="grid gap-4 md:grid-cols-3" variants={staggerContainer} initial="hidden" animate="show">
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<TrendingUp />} label="Total Income This Month" value={monthlyTotal} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<CircleDollarSign />} label="Total Income This Year" value={yearlyTotal} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<CalendarDays />} label="Avg Monthly" value={avgMonthly} />
        </motion.div>
      </motion.div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={month} onValueChange={(value) => setMonth(value ?? String(today.getMonth() + 1))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>{monthNames[Number(month) - 1]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((name, index) => (
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
      </div>

      {filteredIncome.length === 0 ? (
        <EmptyState
          icon={<TrendingUp />}
          title="No income entries yet"
          description="Add your first income source to start tracking your cash flow."
          action={
            <Button onClick={openCreate}>
              <Plus />
              Add your first income
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2.2fr_1fr] items-start">
          <div className="space-y-4">
            <div className="card hidden overflow-hidden md:block">
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
                  {filteredIncome.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="font-medium">{entry.source}</div>
                        {entry.note && (
                          <div className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">{entry.note}</div>
                        )}
                      </TableCell>
                      <TableCell>{entry.category ?? "Uncategorized"}</TableCell>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>{entry.paymentMode}</TableCell>
                      <TableCell className="text-right">
                        <MoneyText value={entry.amount} variant="positive" />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  onClick={() => openEdit(entry)}
                                  aria-label="Edit income"
                                />
                              }
                            >
                              <Pencil />
                            </TooltipTrigger>
                            <TooltipContent>Edit income</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setIncomeToDelete(entry)}
                                  aria-label="Delete income"
                                />
                              }
                            >
                              <Trash2 />
                            </TooltipTrigger>
                            <TooltipContent>Delete income</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="grid gap-3 md:hidden">
              {filteredIncome.map((entry) => (
                <article key={entry.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-medium">{entry.source}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {entry.category ?? "Uncategorized"} · {formatDate(entry.date)}
                      </p>
                    </div>
                    <MoneyText value={entry.amount} variant="positive" className="font-semibold" />
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm text-muted-foreground">
                    <span>{entry.paymentMode}</span>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(entry)} aria-label="Edit income">
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setIncomeToDelete(entry)}
                        aria-label="Delete income"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
            {paymentModeData.length > 0 && (
              <div className="card p-5">
                <div>
                  <h3 className="font-heading text-sm font-semibold">Payment Mode Share</h3>
                  <p className="text-xs text-muted-foreground">Receipts distribution by mode</p>
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
                  <h3 className="font-heading text-sm font-semibold">Income Sources Share</h3>
                  <p className="text-xs text-muted-foreground">Proportions of income sources</p>
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
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit income" : "Add income"}</DialogTitle>
            <DialogDescription>Record an incoming payment and optionally credit a bank account.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="income-amount">Amount</Label>
                <Input
                  id="income-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => updateForm("amount", event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="income-source">Source</Label>
                <Input
                  id="income-source"
                  value={form.source}
                  onChange={(event) => updateForm("source", event.target.value)}
                  placeholder="Salary, client, interest..."
                  required
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
                  placeholder="e.g. Gift, Bonus"
                  required
                />
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Payment mode</Label>
                <Select
                  value={form.paymentMode}
                  onValueChange={(value) => updateForm("paymentMode", (value ?? "Other") as IncomeInput["paymentMode"])}
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
              <div className="grid gap-2">
                <Label>
                  Bank account <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Select
                  value={form.bankAccount || "none"}
                  onValueChange={(value) => updateForm("bankAccount", value === "none" ? "" : (value ?? ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No linked account">
                      {form.bankAccount
                        ? bankAccounts.find((account) => account.id === form.bankAccount)?.name +
                          (bankAccounts.find((account) => account.id === form.bankAccount)?.last4Digits
                            ? ` · ${bankAccounts.find((account) => account.id === form.bankAccount)?.last4Digits}`
                            : "")
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked account</SelectItem>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                        {account.last4Digits ? ` · ${account.last4Digits}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="income-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="income-note"
                value={form.note}
                onChange={(event) => updateForm("note", event.target.value)}
                placeholder="Add context for this payment"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Add income"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!incomeToDelete}
        onOpenChange={(open) => !open && setIncomeToDelete(null)}
        title="Delete Income Entry?"
        description={`Are you sure you want to delete the income entry from ${incomeToDelete?.source}? This will permanently remove it from your records and deduct the amount from any associated bank account or cash wallet.`}
        onConfirm={deleteIncome}
      />
      <LoaderOverlay show={isMutating} label={editing ? "Saving income..." : "Updating income..."} />
    </div>
  );
}
