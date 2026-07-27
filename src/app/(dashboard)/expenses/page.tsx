"use client";

import * as React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { CalendarDays, CircleDollarSign, Pencil, Plus, ReceiptText, Trash2, TrendingDown } from "lucide-react";
import { toast } from "sonner";

import EmptyState from "@/components/finance/EmptyState";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
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
import { type ExpenseEntry, type ExpenseInput, useExpenses } from "@/hooks/useExpenses";
import { useSearchParams } from "next/navigation";
import { useCategories } from "@/hooks/useCategories";

const PAYMENT_MODES = ["Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer"] as const;
const BANK_PAYMENT_MODES = new Set(["UPI", "Debit Card", "Bank Transfer"]);
const MONTHS = Array.from({ length: 12 }, (_, index) => new Date(2024, index).toLocaleString("en", { month: "long" }));

type FormState = {
  amount: string;
  source: string;
  category: string;
  date: string;
  paymentMode: ExpenseInput["paymentMode"];
  bankAccount: string;
  creditCard: string;
  note: string;
};
const emptyForm = (): FormState => ({
  amount: "",
  source: "",
  category: "Food",
  date: format(new Date(), "yyyy-MM-dd"),
  paymentMode: "UPI",
  bankAccount: "",
  creditCard: "",
  note: "",
});
const toForm = (expense: ExpenseEntry): FormState => ({
  amount: String(expense.amount),
  source: expense.source ?? "",
  category: expense.category,
  date: format(new Date(expense.date), "yyyy-MM-dd"),
  paymentMode: expense.paymentMode,
  bankAccount: expense.bankAccount ?? "",
  creditCard: expense.creditCard ?? "",
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
  const showBankAccount = BANK_PAYMENT_MODES.has(form.paymentMode);
  const showCreditCard = form.paymentMode === "Credit Card";

  React.useEffect(() => {
    if (searchParams.get("add") === "true") {
      startCreate();
    }
  }, [searchParams]);

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
    if (showBankAccount && !form.bankAccount) return toast.error("Choose the account to debit.");
    if (showCreditCard && !form.creditCard) return toast.error("Choose a credit card.");

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
      bankAccount: showBankAccount ? form.bankAccount : null,
      creditCard: showCreditCard ? form.creditCard : null,
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

  async function deleteExpense(expense: ExpenseEntry) {
    if (!window.confirm(`Delete this ${expense.category.toLowerCase()} expense?`)) return;
    try {
      await remove(expense.id);
      toast.success("Expense entry deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete expense.");
    }
  }

  if (isLoading) return <PageSkeleton variant="table" />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">Keep a clear view of every outgoing payment.</p>
        </div>
        <Button onClick={startCreate}>
          <Plus />
          Add Expense
        </Button>
      </div>
      <motion.div className="grid gap-4 md:grid-cols-3" variants={staggerContainer} initial="hidden" animate="show">
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<TrendingDown />} label="Total Expense This Month" value={monthTotal} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<CircleDollarSign />} label="Total Expense This Year" value={yearTotal} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<CalendarDays />} label="Avg Monthly" value={averageMonthly} />
        </motion.div>
      </motion.div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Select value={month} onValueChange={(value) => setMonth(value ?? String(today.getMonth() + 1))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
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
            <SelectValue />
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
            <SelectValue />
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
      {filtered.length === 0 ? (
        <EmptyState
          icon={<ReceiptText />}
          title="No expense entries yet"
          description="Add your first expense to start understanding where money goes."
          action={
            <Button onClick={startCreate}>
              <Plus />
              Add your first expense
            </Button>
          }
        />
      ) : (
        <>
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
                {filtered.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>
                      <div className="font-medium">{expense.source || expense.category}</div>
                      {expense.note && (
                        <div className="mt-0.5 max-w-48 truncate text-xs text-muted-foreground">{expense.note}</div>
                      )}
                    </TableCell>
                    <TableCell>{expense.category}</TableCell>
                    <TableCell>{displayDate(expense.date)}</TableCell>
                    <TableCell>{expense.paymentMode}</TableCell>
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
                                onClick={() => void deleteExpense(expense)}
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
          <div className="grid gap-3 md:hidden">
            {filtered.map((expense) => (
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
                  <span>{expense.paymentMode}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={() => startEdit(expense)} aria-label="Edit expense">
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void deleteExpense(expense)}
                      aria-label="Delete expense"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
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
                    <SelectValue />
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
                onValueChange={(value) => updateForm("paymentMode", (value ?? "Cash") as ExpenseInput["paymentMode"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
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
            {showCreditCard && (
              <div className="grid gap-2">
                <Label>Credit card</Label>
                <Select
                  value={form.creditCard || "none"}
                  onValueChange={(value) => updateForm("creditCard", value === "none" ? "" : (value ?? ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a credit card">
                      {form.creditCard
                        ? creditCards.find((card) => card.id === form.creditCard)?.name +
                          ` · ${creditCards.find((card) => card.id === form.creditCard)?.last4Digits}`
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a credit card</SelectItem>
                    {creditCards.map((card) => (
                      <SelectItem key={card.id} value={card.id}>
                        {card.name} · {card.last4Digits}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showBankAccount && (
              <div className="grid gap-2">
                <Label>Bank account to debit</Label>
                <Select
                  value={form.bankAccount || "none"}
                  onValueChange={(value) => updateForm("bankAccount", value === "none" ? "" : (value ?? ""))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose a bank account">
                      {form.bankAccount
                        ? bankAccounts.find((account) => account.id === form.bankAccount)?.name +
                          (bankAccounts.find((account) => account.id === form.bankAccount)?.last4Digits
                            ? ` · ${bankAccounts.find((account) => account.id === form.bankAccount)?.last4Digits}`
                            : "")
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose a bank account</SelectItem>
                    {bankAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                        {account.last4Digits ? ` · ${account.last4Digits}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
      <LoaderOverlay show={isMutating} label={editing ? "Saving expense..." : "Updating expenses..."} />
    </div>
  );
}
