"use client";
import * as React from "react";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Landmark,
  Plus,
  ReceiptText,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import EmptyState from "@/components/finance/EmptyState";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
import useCountUp from "@/hooks/useCountUp";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCashWallet } from "@/hooks/useCashWallet";

const today = () => format(new Date(), "yyyy-MM-dd");

export default function CashWalletPage() {
  const { balance, transactions, isLoading, isMutating, load, recordTransaction, transfer } = useCashWallet();
  const [bankAccounts, setBankAccounts] = React.useState<{ id: string; name: string; last4Digits?: string; currentBalance: number }[]>([]);
  const [loadingAccounts, setLoadingAccounts] = React.useState(false);
  const [transactionOpen, setTransactionOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [transferDirection, setTransferDirection] = React.useState<"Withdrawal" | "Deposit">("Withdrawal");

  const [transactionForm, setTransactionForm] = React.useState({
    type: "Credit" as "Credit" | "Debit",
    amount: "",
    description: "",
    date: today(),
  });

  const [transferForm, setTransferForm] = React.useState({
    bankAccountId: "",
    amount: "",
    description: "",
    date: today(),
  });

  // Fetch Bank Accounts for the Transfer dialogs
  const fetchBankAccounts = React.useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/bank-accounts");
      const data = await res.json();
      if (res.ok) {
        setBankAccounts(data.accounts);
      }
    } catch (err) {
      console.error("Failed to fetch bank accounts for transfer", err);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchBankAccounts();
  }, [fetchBankAccounts]);

  // Statistics
  const totalCashIn = React.useMemo(() => {
    return transactions
      .filter((tx) => tx.type === "Credit")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const totalCashOut = React.useMemo(() => {
    return transactions
      .filter((tx) => tx.type === "Debit")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [transactions]);

  const cashChartData = React.useMemo(() => {
    const map = new Map<string, { month: string; credit: number; debit: number }>();
    const now = new Date();
    // Initialize past 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7); // YYYY-MM
      map.set(key, {
        month: d.toLocaleString("default", { month: "short" }),
        credit: 0,
        debit: 0,
      });
    }

    transactions.forEach((tx) => {
      const key = new Date(tx.date).toISOString().slice(0, 7);
      const existing = map.get(key);
      if (existing) {
        if (tx.type === "Credit") {
          existing.credit += tx.amount;
        } else {
          existing.debit += tx.amount;
        }
      }
    });

    return Array.from(map.values());
  }, [transactions]);

  const cashChartConfig = {
    credit: { label: "Cash In", color: "var(--income)" },
    debit: { label: "Cash Out", color: "var(--expense)" },
  } satisfies ChartConfig;

  const startTransfer = (direction: "Withdrawal" | "Deposit") => {
    setTransferDirection(direction);
    setTransferForm({
      bankAccountId: "",
      amount: "",
      description: "",
      date: today(),
    });
    setTransferOpen(true);
  };

  const startTransaction = () => {
    setTransactionForm({
      type: "Credit",
      amount: "",
      description: "",
      date: today(),
    });
    setTransactionOpen(true);
  };

  async function submitTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(transactionForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount.");
    try {
      await recordTransaction({
        ...transactionForm,
        amount,
        date: new Date(`${transactionForm.date}T12:00:00`).toISOString(),
      });
      toast.success("Cash transaction added successfully.");
      setTransactionOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add cash transaction.");
    }
  }

  async function submitTransfer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(transferForm.amount);
    if (!transferForm.bankAccountId) return toast.error("Select a bank account.");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount.");
    try {
      await transfer({
        direction: transferDirection,
        bankAccountId: transferForm.bankAccountId,
        amount,
        description: transferForm.description || undefined,
        date: new Date(`${transferForm.date}T12:00:00`).toISOString(),
      });
      toast.success(
        transferDirection === "Withdrawal"
          ? "Cash withdrawn from bank account successfully."
          : "Cash deposited to bank account successfully."
      );
      setTransferOpen(false);
      void fetchBankAccounts(); // Refresh bank account balances
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete transfer.");
    }
  }

  if (isLoading) return <PageSkeleton variant="table" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Cash Wallet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Track cash holdings, bank withdrawals/deposits, and cash transactions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => startTransfer("Withdrawal")}>
            <ArrowDownRight className="size-4 text-income" />
            Withdraw from Bank
          </Button>
          <Button variant="outline" onClick={() => startTransfer("Deposit")}>
            <ArrowUpRight className="size-4 text-expense" />
            Deposit to Bank
          </Button>
          <Button onClick={startTransaction}>
            <Plus className="size-4" />
            Adjust Cash
          </Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1.2fr] items-stretch">
        <div>
          <CashVisual balance={balance} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <StatCard icon={<ArrowUpRight className="text-income" />} label="Total Cash In (All Time)" value={totalCashIn} />
          <StatCard icon={<ArrowDownRight className="text-expense" />} label="Total Cash Out (All Time)" value={totalCashOut} />
        </div>
        <div className="card p-5 flex flex-col justify-between">
          <div>
            <h3 className="font-heading text-sm font-semibold">Cash Flow Trend</h3>
            <p className="text-xs text-muted-foreground">Credits vs Debits (Last 6 Months)</p>
          </div>
          <ChartContainer config={cashChartConfig} className="h-32 w-full mt-3">
            <BarChart data={cashChartData}>
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis hide />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="credit" fill="var(--income)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="debit" fill="var(--expense)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      <div>
        <h3 className="font-heading text-lg font-semibold mb-3">Cash Ledger</h3>
        <div className="card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                  <TableCell className="font-medium">{item.description || "Cash Transaction"}</TableCell>
                  <TableCell>
                    <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {item.source}
                    </span>
                  </TableCell>
                  <TableCell className={item.type === "Credit" ? "text-income font-medium" : "text-expense font-medium"}>
                    {item.type}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    <MoneyText value={item.amount} variant={item.type === "Credit" ? "positive" : "negative"} />
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <MoneyText value={item.balanceAfter ?? 0} />
                  </TableCell>
                </TableRow>
              ))}
              {!transactions.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                    No cash transactions recorded yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Adjust Cash Modal */}
      <Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Cash Balance</DialogTitle>
            <DialogDescription>Record a manual adjustment or cash movement.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitTransaction}>
            <div className="grid gap-2">
              <Label>Adjustment Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={transactionForm.type === "Credit" ? "default" : "outline"}
                  onClick={() => setTransactionForm((prev) => ({ ...prev, type: "Credit" }))}
                >
                  <ArrowUpRight className="mr-1 size-4" />
                  Add Cash (Credit)
                </Button>
                <Button
                  type="button"
                  variant={transactionForm.type === "Debit" ? "default" : "outline"}
                  onClick={() => setTransactionForm((prev) => ({ ...prev, type: "Debit" }))}
                >
                  <ArrowDownRight className="mr-1 size-4" />
                  Remove Cash (Debit)
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjust-amount">Amount (₹)</Label>
              <Input
                id="adjust-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={transactionForm.amount}
                onChange={(e) => setTransactionForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjust-description">Description</Label>
              <Input
                id="adjust-description"
                value={transactionForm.description}
                onChange={(e) => setTransactionForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Opening cash balance adjustment"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="adjust-date">Date</Label>
              <Input
                id="adjust-date"
                type="date"
                value={transactionForm.date}
                onChange={(e) => setTransactionForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransactionOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <ReceiptText className="mr-1 size-4" />
                Record Adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog (Withdrawal / Deposit) */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transferDirection === "Withdrawal" ? "Withdraw Cash from Bank" : "Deposit Cash to Bank"}
            </DialogTitle>
            <DialogDescription>
              {transferDirection === "Withdrawal"
                ? "Move money from a bank account to your physical Cash Wallet."
                : "Deposit cash from your wallet into a bank account."}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitTransfer}>
            <div className="grid gap-2">
              <Label>
                {transferDirection === "Withdrawal" ? "Source Bank Account" : "Destination Bank Account"}
              </Label>
              <Select
                value={transferForm.bankAccountId}
                onValueChange={(val) => setTransferForm((prev) => ({ ...prev, bankAccountId: val ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a bank account">
                    {transferForm.bankAccountId
                      ? (() => {
                          const acc = bankAccounts.find((a) => a.id === transferForm.bankAccountId);
                          return acc ? `${acc.name} (•••• ${acc.last4Digits || "----"})` : undefined;
                        })()
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name} (•••• {account.last4Digits || "----"}) · Balance: ₹{account.currentBalance.toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transfer-amount">Amount (₹)</Label>
              <Input
                id="transfer-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={transferForm.amount}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transfer-description">Description (optional)</Label>
              <Input
                id="transfer-description"
                value={transferForm.description}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={
                  transferDirection === "Withdrawal"
                    ? "e.g. ATM withdrawal for weekend expenses"
                    : "e.g. Deposited excess cash at branch"
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="transfer-date">Date</Label>
              <Input
                id="transfer-date"
                type="date"
                value={transferForm.date}
                onChange={(e) => setTransferForm((prev) => ({ ...prev, date: e.target.value }))}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTransferOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                <ArrowRightLeft className="mr-1 size-4" />
                Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LoaderOverlay show={isMutating || loadingAccounts} label="Processing transaction..." />
    </div>
  );
}

function CashVisual({ balance, className = "" }: { balance: number; className?: string }) {
  const animatedBalance = useCountUp(balance, 700);
  return (
    <div
      className={`relative aspect-[1.62/1] overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-transform hover:-translate-y-1 ${className}`}
      style={{ background: "linear-gradient(135deg, #0f766e, #042f2e)" }}
    >
      <div className="absolute -right-8 -top-12 size-44 rounded-full border border-white/15" />
      <div className="absolute -bottom-20 left-10 size-44 rounded-full border border-white/10" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <Banknote className="size-8" />
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            Cash Wallet
          </span>
        </div>
        <div className="mt-auto">
          <p className="text-sm text-white/70 font-medium">Physical Cash Balance</p>
          <MoneyText value={animatedBalance} className="mt-1 text-3xl font-bold tracking-tight" />
          <div className="mt-4 flex justify-between text-xs uppercase tracking-wider text-white/75 font-semibold">
            <span>Primary Wallet</span>
            <span>Liquid Cash</span>
          </div>
        </div>
      </div>
    </div>
  );
}
