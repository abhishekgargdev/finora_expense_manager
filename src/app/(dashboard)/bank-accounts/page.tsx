"use client";
import * as React from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Building2,
  ChevronLeft,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import { Cell, Pie, PieChart, Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import {
  type BankAccount,
  type BankAccountInput,
  type BankTransaction,
  useBankAccounts,
} from "@/hooks/useBankAccounts";
import { Pagination } from "@/components/ui/pagination";
const COLORS = ["#1e3a5f", "#0f766e", "#6d28d9", "#9a3412", "#9f1239", "#334155"];
const today = () => format(new Date(), "yyyy-MM-dd");
const emptyAccount = (): BankAccountInput & { currentBalance?: number } => ({
  bankName: "",
  accountName: "",
  accountType: "Savings",
  last4Digits: "",
  openingBalance: 0,
  currentBalance: 0,
  minimumBalance: 0,
  themeColor: COLORS[0],
});
export default function BankAccountsPage() {
  const { accounts, isLoading, isMutating, create, update, remove, transaction, transfer } = useBankAccounts();
  const lowBalanceAccounts = React.useMemo(() => {
    return accounts.filter((acc) => acc.minimumBalance !== undefined && acc.currentBalance < acc.minimumBalance);
  }, [accounts]);
  const [selected, setSelected] = React.useState<BankAccount | null>(null);
  const [ledger, setLedger] = React.useState<BankTransaction[]>([]);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [selected]);

  const paginatedLedger = React.useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return ledger.slice(start, start + ITEMS_PER_PAGE);
  }, [ledger, currentPage]);

  const totalPages = Math.ceil(ledger.length / ITEMS_PER_PAGE);
  const [accountOpen, setAccountOpen] = React.useState(false);
  const [transactionOpen, setTransactionOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [editingAccount, setEditingAccount] = React.useState<BankAccount | null>(null);
  const [accountForm, setAccountForm] = React.useState<BankAccountInput & { currentBalance?: number }>(emptyAccount());
  const [transactionForm, setTransactionForm] = React.useState({
    type: "Credit" as "Credit" | "Debit",
    amount: "",
    description: "",
    date: today(),
  });
  async function submitTransfer(
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    description: string,
    date: string
  ) {
    try {
      await transfer({
        fromAccountId,
        toAccountId,
        amount,
        description: description || undefined,
        date: new Date(`${date}T12:00:00`).toISOString(),
      });
      toast.success("Funds transferred successfully.");
      setTransferOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to complete transfer.");
    }
  }
  React.useEffect(() => {
    if (!accountOpen) {
      setAccountForm(emptyAccount());
      setEditingAccount(null);
    }
  }, [accountOpen]);

  React.useEffect(() => {
    if (!transactionOpen) {
      setTransactionForm({ type: "Credit", amount: "", description: "", date: today() });
    }
  }, [transactionOpen]);

  const total = accounts.reduce((sum, account) => sum + account.currentBalance, 0);

  const balanceDistributionData = React.useMemo(() => {
    return accounts.map((acc) => ({
      name: acc.accountName || acc.bankName,
      value: acc.currentBalance,
      color: acc.themeColor || "#1e3a5f",
    }));
  }, [accounts]);

  const balanceDistributionConfig = React.useMemo(() => {
    const cfg: ChartConfig = {};
    balanceDistributionData.forEach((item) => {
      cfg[item.name.replace(/\s+/g, "_")] = { label: item.name, color: item.color };
    });
    return cfg;
  }, [balanceDistributionData]);

  const monthlyVolumeData = React.useMemo(() => {
    const map = new Map<string, { month: string; credit: number; debit: number }>();
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      map.set(key, {
        month: d.toLocaleString("default", { month: "short" }),
        credit: 0,
        debit: 0,
      });
    }
    ledger.forEach((tx) => {
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
  }, [ledger]);

  const monthlyVolumeConfig = {
    credit: { label: "Credits", color: "var(--income)" },
    debit: { label: "Debits", color: "var(--expense)" },
  } satisfies ChartConfig;

  async function openAccount(account: BankAccount) {
    setSelected(account);
    try {
      const payload = await read(fetch(`/api/bank-accounts/${account.id}/transactions`));
      setLedger(payload.transactions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load transaction history.");
    }
  }
  function startCreate() {
    setEditingAccount(null);
    setAccountForm(emptyAccount());
    setAccountOpen(true);
  }
  function startEdit(account: BankAccount) {
    setEditingAccount(account);
    setAccountForm({
      bankName: account.bankName,
      accountName: account.accountName || "",
      accountType: account.accountType,
      last4Digits: account.last4Digits || "",
      openingBalance: account.openingBalance,
      currentBalance: account.currentBalance,
      minimumBalance: account.minimumBalance,
      themeColor: account.themeColor || COLORS[0],
    });
    setAccountOpen(true);
  }
  async function submitAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (editingAccount) {
        const payload = await update(editingAccount.id, {
          bankName: accountForm.bankName,
          accountName: accountForm.accountName,
          accountType: accountForm.accountType,
          last4Digits: accountForm.last4Digits,
          themeColor: accountForm.themeColor,
          currentBalance: accountForm.currentBalance,
          minimumBalance: accountForm.minimumBalance,
        });
        toast.success("Bank account updated.");
        if (selected && selected.id === editingAccount.id) {
          setSelected(payload.account);
        }
      } else {
        await create(accountForm);
        toast.success("Bank account added.");
      }
      setAccountOpen(false);
      setAccountForm(emptyAccount());
      setEditingAccount(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save account.");
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
      setTransactionForm({ type: "Credit", amount: "", description: "", date: today() });
      await openAccount({
        ...selected,
        currentBalance: selected.currentBalance + (transactionForm.type === "Credit" ? amount : -amount),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to add transaction.");
    }
  }
  const [accountToDelete, setAccountToDelete] = React.useState<BankAccount | null>(null);
  async function deleteAccount() {
    if (!accountToDelete) return;
    try {
      await remove(accountToDelete.id);
      toast.success("Bank account deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete account.");
    }
  }
  if (isLoading) return <PageSkeleton variant="table" />;
  if (selected)
    return (
      <div className="space-y-6">
        <Button variant="ghost" className="-ml-3" onClick={() => setSelected(null)}>
          <ChevronLeft />
          All accounts
        </Button>
        {selected.currentBalance < selected.minimumBalance && (
          <div className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-4 flex gap-3 items-center">
            <AlertTriangle className="size-5 text-destructive shrink-0 animate-bounce" />
            <div className="flex-1 min-w-0">
              <h4 className="font-heading text-sm font-semibold text-destructive">Account Balance Below Minimum Limit</h4>
              <p className="text-xs text-muted-foreground">
                Current balance is <span className="font-bold text-destructive"><MoneyText value={selected.currentBalance} /></span>, which is below the minimum limit of <span className="font-semibold"><MoneyText value={selected.minimumBalance} /></span>.
              </p>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          <AccountVisual account={selected} className="w-full max-w-md shrink-0" />
          <div className="min-w-0 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-heading text-2xl font-semibold">{selected.accountName || selected.bankName}</h2>
                <p className="text-sm text-muted-foreground">
                  {selected.bankName} · {selected.accountType}
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => startEdit(selected)}>
                  <Pencil className="size-4" />
                  Edit Account
                </Button>
                <Button onClick={() => setTransactionOpen(true)}>
                  <Plus />
                  Add Transaction
                </Button>
              </div>
            </div>
            <div className="card p-4 mt-4">
              <div>
                <h3 className="font-heading text-xs font-semibold">Account Monthly Volume</h3>
                <p className="text-[10px] text-muted-foreground">Credits vs Debits (Last 6 Months)</p>
              </div>
              <ChartContainer config={monthlyVolumeConfig} className="h-28 w-full mt-2">
                <BarChart data={monthlyVolumeData}>
                  <XAxis dataKey="month" tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="credit" fill="var(--income)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="debit" fill="var(--expense)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
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
                {paginatedLedger.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                    <TableCell className="font-medium">{item.description || "Transaction"}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-1 text-xs">{item.source}</span>
                    </TableCell>
                    <TableCell className={item.type === "Credit" ? "text-income" : "text-expense"}>{item.type}</TableCell>
                    <TableCell className="text-right">
                      <MoneyText value={item.amount} variant={item.type === "Credit" ? "positive" : "negative"} />
                    </TableCell>
                    <TableCell className="text-right">
                      <MoneyText value={item.balanceAfter ?? 0} />
                    </TableCell>
                  </TableRow>
                ))}
                {!ledger.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No transactions recorded yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {ledger.length > 0 && (
            <div className="border-t px-4 bg-muted/10">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={ledger.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          )}
        </div>
        <TransactionDialog
          open={transactionOpen}
          onOpenChange={setTransactionOpen}
          form={transactionForm}
          setForm={setTransactionForm}
          onSubmit={submitTransaction}
        />
        <LoaderOverlay show={isMutating} label="Updating account..." />
      </div>
    );
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Bank Accounts</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A single, up-to-date view of your cash across every account.
          </p>
        </div>
        <div className="flex gap-2">
          {accounts.length > 1 && (
            <Button variant="outline" onClick={() => setTransferOpen(true)}>
              <ArrowRightLeft className="size-4" />
              Transfer Funds
            </Button>
          )}
          <Button onClick={startCreate}>
            <Plus />
            Add Account
          </Button>
        </div>
      </div>

      {lowBalanceAccounts.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/25 text-destructive rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-4 duration-300">
          <span className="flex p-2 bg-destructive/15 text-destructive rounded-lg shrink-0 animate-pulse">
            <AlertTriangle className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <h4 className="font-heading text-sm font-semibold text-destructive">Low Balance Alert</h4>
            <p className="text-xs mt-0.5 text-muted-foreground">
              The following account{lowBalanceAccounts.length > 1 ? "s are" : " is"} below the set minimum limit:
            </p>
            <ul className="mt-2 space-y-1 text-xs font-semibold">
              {lowBalanceAccounts.map((acc) => (
                <li key={acc.id} className="flex flex-wrap items-center gap-1.5 text-foreground/90">
                  <span className="text-destructive">•</span>
                  <span>{acc.accountName ? `${acc.bankName} (${acc.accountName})` : acc.bankName}:</span>
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
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr] items-stretch">
        <div className="grid gap-4 max-w-sm">
          <StatCard icon={<Landmark />} label="Total Balance" value={total} />
        </div>
        {accounts.length > 0 && (
          <div className="card p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-heading text-sm font-semibold">Balance Distribution</h3>
              <p className="text-xs text-muted-foreground">Allocation of liquid capital across bank accounts</p>
            </div>
            <div className="flex justify-center mt-3">
              <ChartContainer config={balanceDistributionConfig} className="h-36 w-full aspect-square max-w-[150px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
                  <Pie data={balanceDistributionData} dataKey="value" nameKey="name" innerRadius="48%" outerRadius="72%">
                    {balanceDistributionData.map((asset: any, index: number) => (
                      <Cell key={index} fill={asset.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </div>
      {accounts.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <div key={account.id} className="group relative">
              <button className="w-full text-left" onClick={() => void openAccount(account)}>
                <AccountVisual account={account} />
              </button>
              <div className="absolute bottom-3 right-3 flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/80 hover:bg-white/15 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEdit(account);
                  }}
                  aria-label="Edit account"
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/80 hover:bg-white/15 hover:text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAccountToDelete(account);
                  }}
                  aria-label="Delete account"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 />}
          title="No bank accounts yet"
          description="Add an account to see your balances and transaction history in one place."
          action={
            <Button onClick={startCreate}>
              <Plus />
              Add your first bank account
            </Button>
          }
        />
      )}
      <AccountDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        form={accountForm}
        setForm={setAccountForm}
        onSubmit={submitAccount}
        isEdit={!!editingAccount}
      />
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        accounts={accounts}
        onSubmit={submitTransfer}
      />
      <ConfirmDialog
        open={!!accountToDelete}
        onOpenChange={(open) => !open && setAccountToDelete(null)}
        title="Delete Bank Account?"
        description={`Are you sure you want to delete ${accountToDelete?.accountName || accountToDelete?.bankName}? This will permanently remove the account and all of its associated transactions.`}
        onConfirm={deleteAccount}
      />
      <LoaderOverlay show={isMutating} label="Updating bank accounts..." />
    </div>
  );
}
async function read(response: Response | Promise<Response>) {
  const result = await response;
  const payload = await result.json();
  if (!result.ok) throw new Error(payload.error ?? "Something went wrong.");
  return payload;
}
function AccountVisual({ account, className = "" }: { account: BankAccount; className?: string }) {
  const balance = useCountUp(account.currentBalance, 700);
  const color = account.themeColor || COLORS[0];
  return (
    <div
      className={`relative aspect-[1.62/1] overflow-hidden rounded-2xl p-5 text-white shadow-lg transition-transform group-hover:-translate-y-1 ${className}`}
      style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 52%, black))` }}
    >
      <div className="absolute -right-8 -top-12 size-44 rounded-full border border-white/15" />
      <div className="absolute -bottom-20 left-10 size-44 rounded-full border border-white/10" />
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between">
          <Building2 />
          <div className="flex gap-1.5 items-center">
            {account.currentBalance < account.minimumBalance && (
              <span className="rounded-full bg-destructive text-white px-2 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 animate-pulse shadow-md">
                <AlertTriangle className="size-3 animate-bounce" /> Low
              </span>
            )}
            <span className="rounded-full bg-white/15 px-2 py-1 text-xs">{account.accountType}</span>
          </div>
        </div>
        <div className="mt-auto">
          <p className="text-sm text-white/70">Current balance</p>
          <MoneyText value={balance} className="mt-1 text-3xl font-bold tracking-tight" />
          <div className="mt-4 flex justify-between text-xs uppercase tracking-wider text-white/75">
            <span>{account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName}</span>
            <span>•••• {account.last4Digits || "----"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
function AccountDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
  isEdit = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: BankAccountInput & { currentBalance?: number };
  setForm: React.Dispatch<React.SetStateAction<BankAccountInput & { currentBalance?: number }>>;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  isEdit?: boolean;
}) {
  const change = <K extends keyof (BankAccountInput & { currentBalance?: number })>(
    key: K,
    value: (BankAccountInput & { currentBalance?: number })[K]
  ) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit bank account" : "Add bank account"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update details or correct the balance of your bank account."
              : "Set an opening balance to start a complete account ledger."}
          </DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Bank name</Label>
              <Input value={form.bankName} onChange={(event) => change("bankName", event.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label>Account nickname</Label>
              <Input
                value={form.accountName || ""}
                onChange={(event) => change("accountName", event.target.value)}
                placeholder="Everyday savings"
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Account type</Label>
              <Select
                value={form.accountType}
                onValueChange={(value) =>
                  change("accountType", (value ?? "Savings") as BankAccountInput["accountType"])
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{form.accountType}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Savings">Savings</SelectItem>
                  <SelectItem value="Current">Current</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Last 4 digits</Label>
              <Input
                value={form.last4Digits || ""}
                maxLength={4}
                inputMode="numeric"
                onChange={(event) => change("last4Digits", event.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {isEdit ? (
              <div className="grid gap-2">
                <Label>Current balance (to adjust)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.currentBalance ?? ""}
                  onChange={(event) => change("currentBalance", Number(event.target.value))}
                  required
                />
              </div>
            ) : (
              <div className="grid gap-2">
                <Label>Opening balance</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.openingBalance || ""}
                  onChange={(event) => change("openingBalance", Number(event.target.value))}
                  required
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label>Minimum limit</Label>
              <Input
                type="number"
                step="0.01"
                value={form.minimumBalance ?? ""}
                onChange={(event) => change("minimumBalance", Number(event.target.value))}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Theme color</Label>
            <div className="flex gap-2">
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
            <Button type="submit">{isEdit ? "Save changes" : "Add account"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
function TransactionDialog({
  open,
  onOpenChange,
  form,
  setForm,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: { type: "Credit" | "Debit"; amount: string; description: string; date: string };
  setForm: React.Dispatch<
    React.SetStateAction<{ type: "Credit" | "Debit"; amount: string; description: string; date: string }>
  >;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const change = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add transaction</DialogTitle>
          <DialogDescription>Add a cash deposit, withdrawal, or other manual movement.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={onSubmit}>
          <div className="grid gap-2">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={form.type === "Credit" ? "default" : "outline"}
                onClick={() => change("type", "Credit")}
              >
                <ArrowUpRight />
                Credit
              </Button>
              <Button
                type="button"
                variant={form.type === "Debit" ? "default" : "outline"}
                onClick={() => change("type", "Debit")}
              >
                <ArrowDownRight />
                Debit
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
              placeholder="Cash deposit"
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
function TransferDialog({
  open,
  onOpenChange,
  accounts,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: BankAccount[];
  onSubmit: (
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    description: string,
    date: string
  ) => Promise<void>;
}) {
  const [fromAccountId, setFromAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [date, setDate] = React.useState(today());

  React.useEffect(() => {
    if (open) {
      setFromAccountId("");
      setToAccountId("");
      setAmount("");
      setDescription("");
      setDate(today());
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numAmount = Number(amount);
    if (!fromAccountId || !toAccountId) {
      toast.error("Please select both source and destination accounts.");
      return;
    }
    if (fromAccountId === toAccountId) {
      toast.error("Source and destination accounts must be different.");
      return;
    }
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      toast.error("Please enter a valid transfer amount.");
      return;
    }
    await onSubmit(fromAccountId, toAccountId, numAmount, description, date);
  };

  const destinationAccounts = accounts.filter((a) => a.id !== fromAccountId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer Funds</DialogTitle>
          <DialogDescription>Move money between your bank accounts.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <Label>From Account</Label>
            <Select value={fromAccountId} onValueChange={(val) => setFromAccountId(val ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select source account">
                  {fromAccountId
                    ? (() => {
                        const acc = accounts.find((a) => a.id === fromAccountId);
                        return acc
                          ? `${acc.accountName ? `${acc.bankName} (${acc.accountName})` : acc.bankName} (•••• ${acc.last4Digits || "----"})`
                          : undefined;
                      })()
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName} (•••• {account.last4Digits || "----"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>To Account</Label>
            <Select value={toAccountId} onValueChange={(val) => setToAccountId(val ?? "")} disabled={!fromAccountId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={fromAccountId ? "Select destination account" : "Select source account first"}>
                  {toAccountId
                    ? (() => {
                        const acc = accounts.find((a) => a.id === toAccountId);
                        return acc
                          ? `${acc.accountName ? `${acc.bankName} (${acc.accountName})` : acc.bankName} (•••• ${acc.last4Digits || "----"})`
                          : undefined;
                      })()
                    : undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {destinationAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName} (•••• {account.last4Digits || "----"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Amount</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>Description (optional)</Label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="e.g. Monthly savings transfer"
            />
          </div>

          <div className="grid gap-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Transfer</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
