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
  const { cards, loading, mutating, create, update, remove, generateBill } = useCreditCards();
  const [form, setForm] = React.useState<CardInput>(empty());
  const [addOpen, setAddOpen] = React.useState(false);
  const [editingCard, setEditingCard] = React.useState<CreditCard | null>(null);
  const [selected, setSelected] = React.useState<CreditCard | null>(null);
  const [transactions, setTransactions] = React.useState<CardTransaction[]>([]);
  const [bills, setBills] = React.useState<CardBill[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<{ id: string; name: string; last4Digits?: string }[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [payBill, setPayBill] = React.useState<CardBill | null>(null);
  const [bankAccount, setBankAccount] = React.useState("");
  const totalLimit = cards.reduce((sum, card) => sum + card.creditLimit, 0);
  const outstanding = cards.reduce((sum, card) => sum + card.outstanding, 0);
  const available = cards.reduce((sum, card) => sum + card.availableCredit, 0);
  async function openCard(card: CreditCard) {
    setSelected(card);
    setDetailLoading(true);
    try {
      const [detail, tx, bill, accounts] = await Promise.all([
        read(fetch(`/api/credit-cards/${card.id}`)),
        read(fetch(`/api/credit-cards/${card.id}/transactions`)),
        read(fetch(`/api/credit-cards/${card.id}/bills`)),
        read(fetch("/api/income")),
      ]);
      setSelected(detail.card);
      setTransactions(tx.transactions);
      setBills(bill.bills);
      setBankAccounts(accounts.bankAccounts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load card details.");
    } finally {
      setDetailLoading(false);
    }
  }
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
  async function deleteCard(card: CreditCard) {
    if (!window.confirm(`Delete ${card.cardName}?`)) return;
    try {
      await remove(card.id);
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
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <CreditCardVisual card={selected} className="w-full max-w-md shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-semibold">{selected.cardName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {selected.bankName} · Billing day {selected.billingCycleDay} · Due day {selected.dueDay}
                </p>
              </div>
              <Button variant="outline" onClick={() => startEdit(selected)}>
                <Pencil className="size-4" />
                Edit Card
              </Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <StatCard icon={<ReceiptText />} label="Outstanding" value={selected.outstanding} />
              <StatCard icon={<WalletCards />} label="Available credit" value={selected.availableCredit} />
            </div>
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
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailLoading ? (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          Loading transactions…
                        </TableCell>
                      </TableRow>
                    ) : transactions.length ? (
                      transactions.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.description || "Card purchase"}</TableCell>
                          <TableCell>{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                          <TableCell>
                            <StatusBadge status={item.billed ? "Billed" : "Current cycle"} />
                          </TableCell>
                          <TableCell className="text-right">
                            <MoneyText value={item.amount} />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                          No transactions for this card yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
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
                    {bills.map((bill) => {
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
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Landmark />} label="Total Credit Limit" value={totalLimit} />
        <StatCard icon={<ReceiptText />} label="Total Outstanding" value={outstanding} />
        <StatCard icon={<Banknote />} label="Total Available Credit" value={available} />
      </div>
      {cards.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <div key={card.id} className="group relative">
              <button className="w-full text-left" onClick={() => void openCard(card)}>
                <CreditCardVisual card={card} />
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{card.cardName}</div>
                    <div className="text-sm text-muted-foreground">
                      Available <MoneyText value={card.availableCredit} />
                    </div>
                  </div>
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
                    void deleteCard(card);
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
