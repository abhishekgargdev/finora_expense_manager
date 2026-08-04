"use client";
import * as React from "react";
import { format } from "date-fns";
import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CreditCard as CardIcon,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import EmptyState from "@/components/finance/EmptyState";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
import StatusBadge from "@/components/finance/StatusBadge";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import PageSkeleton from "@/components/loader/PageSkeleton";
import { Button } from "@/components/ui/button";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";

import {
  type CardBill,
  type CardInput,
  type CardTransaction,
  type CreditCard,
  useCreditCards,
} from "@/hooks/useCreditCards";
const COLORS = ["#25364d", "#49358c", "#0f766e", "#9a3412", "#334155", "#9f1239"];
const empty = (): CardInput => ({
  cardName: "",
  bankName: "",
  last4Digits: "",
  billingCycleDay: 1,
  dueDay: 10,
  creditLimit: 0,
  themeColor: COLORS[0],
});
async function read(response: Response | Promise<Response>) {
  const result = await response;
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}
export default function CreditCardsPage() {
  const { cards, loading, mutating, create, update, remove, generateBill, transaction } = useCreditCards();
  const [form, setForm] = React.useState<CardInput>(empty());
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<CreditCard | null>(null);
  const [selected, setSelected] = React.useState<CreditCard | null>(null);
  const [transactions, setTransactions] = React.useState<CardTransaction[]>([]);
  const [bills, setBills] = React.useState<CardBill[]>([]);

  const ITEMS_PER_PAGE = 10;
  const [txPage, setTxPage] = React.useState(1);
  const [billPage, setBillPage] = React.useState(1);

  React.useEffect(() => {
    setTxPage(1);
    setBillPage(1);
  }, [selected]);

  const paginatedTransactions = React.useMemo(() => {
    const start = (txPage - 1) * ITEMS_PER_PAGE;
    return transactions.slice(start, start + ITEMS_PER_PAGE);
  }, [transactions, txPage]);

  const paginatedBills = React.useMemo(() => {
    const start = (billPage - 1) * ITEMS_PER_PAGE;
    return bills.slice(start, start + ITEMS_PER_PAGE);
  }, [bills, billPage]);

  const totalTxPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const totalBillPages = Math.ceil(bills.length / ITEMS_PER_PAGE);

  const [bankAccounts, setBankAccounts] = React.useState<{ id: string; name: string; last4Digits?: string }[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [payBill, setPayBill] = React.useState<CardBill | null>(null);
  const [bankAccount, setBankAccount] = React.useState("");
  const [transactionOpen, setTransactionOpen] = React.useState(false);
  const [transactionForm, setTransactionForm] = React.useState({
    type: "Charge" as "Charge" | "Credit",
    amount: "",
    description: "",
    date: format(new Date(), "yyyy-MM-dd"),
  });
  const totalLimit = cards.reduce((sum, card) => sum + card.creditLimit, 0);
  const outstanding = cards.reduce((sum, card) => sum + card.outstanding, 0);
  const available = cards.reduce((sum, card) => sum + card.availableCredit, 0);

  const ccBreakdownData = React.useMemo(() => {
    return cards.map((card) => ({
      name: card.cardName,
      outstanding: card.outstanding,
      available: card.availableCredit,
    }));
  }, [cards]);

  const ccBreakdownConfig = {
    outstanding: { label: "Outstanding", color: "var(--expense)" },
    available: { label: "Available Limit", color: "var(--income)" },
  } satisfies ChartConfig;

  const singleCcData = React.useMemo(() => {
    const map = new Map<string, { month: string; amount: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      map.set(key, {
        month: d.toLocaleString("default", { month: "short" }),
        amount: 0,
      });
    }
    transactions.forEach((tx) => {
      const key = new Date(tx.date).toISOString().slice(0, 7);
      const existing = map.get(key);
      if (existing) {
        existing.amount += Math.abs(tx.amount);
      }
    });
    return Array.from(map.values());
  }, [transactions]);

  const singleCcConfig = {
    amount: { label: "Spent", color: "var(--primary)" },
  } satisfies ChartConfig;
  async function openCard(card: CreditCard) {
    setSelected(card);
    setDetailLoading(true);
    try {
      const [detail, tx, bill, accounts] = await Promise.all([
        read(fetch(`/api/credit-cards/${card.id}`)),
        read(fetch(`/api/credit-cards/${card.id}/transactions`)),
        read(fetch(`/api/credit-cards/${card.id}/bills`)),
        read(fetch("/api/bank-accounts")),
      ]);
      setSelected(detail.card);
      setTransactions(tx.transactions);
      setBills(bill.bills);
      setBankAccounts(
        accounts.accounts.map((account: { id: string; bankName: string; accountName?: string; last4Digits?: string }) => ({
          id: account.id,
          name: account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName,
          last4Digits: account.last4Digits,
        }))
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load card details.");
    } finally {
      setDetailLoading(false);
    }
  }

  React.useEffect(() => {
    if (!transactionOpen) {
      setTransactionForm({
        type: "Charge",
        amount: "",
        description: "",
        date: format(new Date(), "yyyy-MM-dd"),
      });
    }
  }, [transactionOpen]);
  function startCreate() {
    setEditingCard(null);
    setForm(empty());
    setAddOpen(true);
  }
  function startEdit(card: CreditCard) {
    setEditingCard(card);
    setForm({
      cardName: card.cardName,
      bankName: card.bankName,
      last4Digits: card.last4Digits,
      billingCycleDay: card.billingCycleDay,
      dueDay: card.dueDay,
      creditLimit: card.creditLimit,
      themeColor: card.themeColor || COLORS[0],
    });
    setAddOpen(true);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingCard) {
        const payload = await update(editingCard.id, form);
        toast.success("Credit card updated.");
        if (selected && selected.id === editingCard.id) {
          setSelected(payload.card);
        }
      } else {
        await create(form);
        toast.success("Credit card added.");
      }
      setAddOpen(false);
      setForm(empty());
      setEditingCard(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save card.");
    }
  }
  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const amount = Number(transactionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount.");
    try {
      await transaction(selected.id, {
        ...transactionForm,
        amount,
        date: new Date(`${transactionForm.date}T12:00:00`).toISOString(),
      });
      toast.success("Transaction added.");
      setTransactionOpen(false);
      await openCard(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add transaction.");
    }
  }
  async function generate() {
    if (!selected) return;
    try {
      await generateBill(selected.id);
      toast.success("Bill generated.");
      await openCard(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to generate bill.");
    }
  }
  async function markPaid() {
    if (!selected || !payBill) return;
    try {
      await read(
        fetch(`/api/credit-cards/${selected.id}/bills/${payBill.id}/pay`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bankAccount: bankAccount || undefined }),
        })
      );
      toast.success("Bill marked as paid.");
      setPayBill(null);
      await openCard(selected);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to pay bill.");
    }
  }
  const [cardToDelete, setCardToDelete] = React.useState<CreditCard | null>(null);
  async function deleteCard() {
    if (!cardToDelete) return;
    try {
      await remove(cardToDelete.id);
      toast.success("Credit card deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete card.");
    }
  }
  if (loading) return <PageSkeleton variant="table" />;
  if (selected)
    return (
      <div className="space-y-6">
        <Button variant="ghost" className="-ml-3" onClick={() => setSelected(null)}>
          <ChevronLeft />
          All cards
        </Button>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          <CreditCardVisual card={selected} className="w-full max-w-md shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-semibold">{selected.cardName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.bankName} · Billing day {selected.billingCycleDay} · Due day {selected.dueDay}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => startEdit(selected)}>
                  <Pencil className="size-4" />
                  Edit Card
                </Button>
                <Button onClick={() => setTransactionOpen(true)}>
                  <Plus />
                  Add Transaction
                </Button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard icon={<ReceiptText />} label="Outstanding" value={selected.outstanding} />
              <StatCard icon={<WalletCards />} label="Available credit" value={selected.availableCredit} />
            </div>
          </div>
          <div className="card p-5 min-w-[280px] lg:max-w-xs flex-1 flex flex-col justify-between">
            <div>
              <h4 className="font-heading text-xs font-semibold">Card Monthly Spend</h4>
              <p className="text-[10px] text-muted-foreground">Recent transactions total</p>
            </div>
            <ChartContainer config={singleCcConfig} className="h-28 w-full mt-2">
              <BarChart data={singleCcData}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} />
                <YAxis hide />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="amount" fill={selected.themeColor || "var(--primary)"} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
        <Tabs defaultValue="transactions">
          <TabsList>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="bills">Bill History</TabsTrigger>
          </TabsList>
          <TabsContent value="transactions" className="mt-4">
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailLoading ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          Loading transactions…
                        </TableCell>
                      </TableRow>
                    ) : paginatedTransactions.length ? (
                      paginatedTransactions.map((item) => {
                        const isCredit = item.amount < 0;
                        return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description || "Card purchase"}</TableCell>
                          <TableCell>{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                          <TableCell className={isCredit ? "text-income" : "text-expense"}>
                            {isCredit ? "Credit" : "Charge"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.billed ? "Billed" : "Current cycle"} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyText value={Math.abs(item.amount)} variant={isCredit ? "positive" : "negative"} />
                          </TableCell>
                        </TableRow>
                      )})
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No transactions for this card yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {transactions.length > 0 && (
                <div className="border-t px-4 bg-muted/10">
                  <Pagination
                    currentPage={txPage}
                    totalPages={totalTxPages}
                    onPageChange={setTxPage}
                    totalItems={transactions.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                  />
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="bills" className="mt-4">
            <div className="mb-3 flex justify-end">
              <Button variant="outline" onClick={() => void generate()}>
                <ReceiptText />
                Generate bill
              </Button>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Billing month</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBills.map((bill) => {
                      const overdue = !bill.isPaid && new Date(bill.dueDate) < new Date();
                      return (
                        <TableRow key={bill.id} className={overdue ? "bg-expense-10" : ""}>
                          <TableCell className="font-medium">{bill.billingMonth}</TableCell>
                          <TableCell className={overdue ? "font-medium text-expense" : ""}>
                            {format(new Date(bill.dueDate), "dd MMM yyyy")}
                            {overdue ? " · Overdue" : ""}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={bill.isPaid ? "Paid" : "Unpaid"} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyText value={bill.totalAmount} />
                          </TableCell>
                          <TableCell className="text-right">
                            {!bill.isPaid && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPayBill(bill);
                                  setBankAccount("");
                                }}
                              >
                                Mark as Paid
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {!detailLoading && !bills.length && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                          No bills generated yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {bills.length > 0 && (
                <div className="border-t px-4 bg-muted/10">
                  <Pagination
                    currentPage={billPage}
                    totalPages={totalBillPages}
                    onPageChange={setBillPage}
                    totalItems={bills.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                  />
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
        <Dialog open={!!payBill} onOpenChange={(open) => !open && setPayBill(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark bill as paid</DialogTitle>
              <DialogDescription>You can optionally record the payment against a bank account.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              <Label>Pay from</Label>
              <Select
                value={bankAccount || "none"}
                onValueChange={(value) => setBankAccount(value === "none" ? "" : (value ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No bank account">
                    {bankAccount
                      ? bankAccounts.find((account) => account.id === bankAccount)?.name +
                        (bankAccounts.find((account) => account.id === bankAccount)?.last4Digits
                          ? ` · ${bankAccounts.find((account) => account.id === bankAccount)?.last4Digits}`
                          : "")
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No bank account</SelectItem>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                      {account.last4Digits ? ` · ${account.last4Digits}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPayBill(null)}>
                Cancel
              </Button>
              <Button onClick={() => void markPaid()}>
                <CheckCircle2 />
                Mark paid
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <CardTransactionDialog
          open={transactionOpen}
          onOpenChange={setTransactionOpen}
          form={transactionForm}
          setForm={setTransactionForm}
          onSubmit={submitTransaction}
        />
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Credit Cards</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track card spending, credit availability, and bill payments.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus />
          Add Card
        </Button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr] items-stretch">
        <div className="grid gap-4">
          <StatCard icon={<Landmark />} label="Total Credit Limit" value={totalLimit} />
          <StatCard icon={<ReceiptText />} label="Total Outstanding" value={outstanding} />
          <StatCard icon={<Banknote />} label="Total Available Credit" value={available} />
        </div>
        {cards.length > 0 && (
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-heading text-sm font-semibold">Credit Limit Breakdown by Card</h3>
              <p className="text-xs text-muted-foreground">Outstanding vs Available Limit</p>
            </div>
            <ChartContainer config={ccBreakdownConfig} className="h-44 w-full mt-4">
              <BarChart data={ccBreakdownData}>
                <XAxis dataKey="name" tickLine={false} axisLine={false} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="outstanding" fill="var(--expense)" stackId="a" />
                <Bar dataKey="available" fill="var(--income)" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </div>
      {cards.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="group relative">
              <button className="w-full text-left" onClick={() => void openCard(card)}>
                <CreditCardVisual card={card} />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{card.cardName}</div>
                    <div className="text-sm text-muted-foreground">
                      Outstanding <MoneyText value={card.outstanding} /> · Available{" "}
                      <MoneyText value={card.availableCredit} />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      void openCard(card);
                    }}
                  >
                    Manage
                  </Button>
                </div>
              </button>
              <div className="absolute bottom-0 right-0 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/80 hover:bg-white/15 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(card);
                  }}
                  aria-label="Edit card"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/80 hover:bg-white/15 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCardToDelete(card);
                  }}
                  aria-label="Delete card"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CardIcon />}
          title="No credit cards yet"
          description="Add a card to follow its purchases and billing cycles."
          action={
            <Button onClick={startCreate}>
              <Plus />
              Add your first card
            </Button>
          }
        />
      )}
      <CardDialog open={addOpen} onOpenChange={setAddOpen} form={form} setForm={setForm} onSubmit={submit} isEdit={!!editingCard} />
      <ConfirmDialog
        open={!!cardToDelete}
        onOpenChange={(open) => !open && setCardToDelete(null)}
        title="Delete Credit Card?"
        description={`Are you sure you want to delete ${cardToDelete?.cardName}? This will permanently remove the card and all its transaction history.`}
        onConfirm={deleteCard}
      />
      <LoaderOverlay show={mutating} label="Updating credit cards..." />
    </div>
  );
}
function CreditCardVisual({ card, className = "" }: { card: CreditCard; className?: string }) {
  const color = card.themeColor || COLORS[0];
  return (
    <div
      className={`relative aspect-[1.586/1] overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-transform group-hover:-translate-y-1 ${className}`}
      style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 55%, black))` }}
    >
      <div className="absolute -right-10 -top-12 size-44 rounded-full border border-white/20" />
      <div className="absolute -bottom-16 left-12 size-40 rounded-full border border-white/10" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <div className="flex size-10 flex-col justify-center gap-1 rounded-md bg-amber-200/80 p-1">
            <span className="border-t border-amber-600/50" />
            <span className="border-t border-amber-600/50" />
            <span className="border-t border-amber-600/50" />
          </div>
          <CardIcon className="opacity-80" />
        </div>
        <div className="mt-auto">
          <div className="text-lg tracking-[0.22em]">•••• {card.last4Digits}</div>
          <div className="mt-3 flex justify-between text-xs uppercase tracking-wider text-white/75">
            <span>{card.cardName}</span>
            <span>{card.bankName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function CardTransactionDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { type: "Charge" | "Credit"; amount: string; description: string; date: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ type: "Charge" | "Credit"; amount: string; description: string; date: string }>
  >;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const change = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add card transaction</DialogTitle>
          <DialogDescription>Record a manual charge or credit on this card.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.type === "Charge" ? "default" : "outline"}
                onClick={() => change("type", "Charge")}
              >
                Charge
              </Button>
              <Button
                type="button"
                variant={form.type === "Credit" ? "default" : "outline"}
                onClick={() => change("type", "Credit")}
              >
                Credit / Refund
              </Button>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(event) => change("amount", event.target.value)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Description</Label>
            <Input
              value={form.description}
              onChange={(event) => change("description", event.target.value)}
              placeholder="Online purchase, refund, fee..."
              required
            />
          </div>
          <div className="grid gap-2">
            <Label>Date</Label>
            <Input type="date" value={form.date} onChange={(event) => change("date", event.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              <ReceiptText />
              Add transaction
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function CardDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isEdit = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: CardInput;
  setForm: React.Dispatch<React.SetStateAction<CardInput>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isEdit?: boolean;
}) {
  const change = <K extends keyof CardInput>(key: K, value: CardInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit credit card" : "Add credit card"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update your credit card details." : "Keep the details needed to track your card's billing cycle."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Card name</Label>
              <Input value={form.cardName} onChange={(event) => change("cardName", event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label>Bank name</Label>
              <Input value={form.bankName} onChange={(event) => change("bankName", event.target.value)} required />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Last 4 digits</Label>
              <Input
                value={form.last4Digits}
                maxLength={4}
                inputMode="numeric"
                onChange={(event) => change("last4Digits", event.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Credit limit</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.creditLimit || ""}
                onChange={(event) => change("creditLimit", Number(event.target.value))}
                required
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Billing cycle day</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.billingCycleDay}
                onChange={(event) => change("billingCycleDay", Number(event.target.value))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label>Due day</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={form.dueDay}
                onChange={(event) => change("dueDay", Number(event.target.value))}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Card color</Label>
            <div className="flex gap-3">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`size-8 rounded-full ring-offset-2 ${form.themeColor === color ? "ring-2 ring-primary" : ""}`}
                  style={{ backgroundColor: color }}
                  onClick={() => change("themeColor", color)}
                  aria-label={`Select ${color}`}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEdit ? "Save changes" : "Add card"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
