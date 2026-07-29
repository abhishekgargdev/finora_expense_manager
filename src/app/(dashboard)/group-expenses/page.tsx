"use client";
import * as React from "react";
import { format } from "date-fns";
import {
  ArrowDownRight,
  ArrowRightLeft,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  ChevronLeft,
  CreditCard,
  Landmark,
  Plus,
  ReceiptText,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Cell, Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import EmptyState from "@/components/finance/EmptyState";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
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
import { useGroups, type Group, type GroupDetail } from "@/hooks/useGroups";

const today = () => format(new Date(), "yyyy-MM-dd");

export default function GroupExpensesPage() {
  const { groups, loading, mutating, createGroup, fetchGroup, deleteGroup, addExpense } = useGroups();

  const [selectedGroup, setSelectedGroup] = React.useState<GroupDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);

  // Modals Open/Close
  const [createOpen, setCreateOpen] = React.useState(false);
  const [expenseOpen, setExpenseOpen] = React.useState(false);
  const [settleOpen, setSettleOpen] = React.useState(false);

  // Bank & Credit Card Lists
  const [bankAccounts, setBankAccounts] = React.useState<{ id: string; name: string; last4Digits?: string }[]>([]);
  const [creditCards, setCreditCards] = React.useState<{ id: string; name: string; last4Digits: string }[]>([]);

  // Create Group Form
  const [groupForm, setGroupForm] = React.useState({
    name: "",
    description: "",
    newMemberName: "",
    members: ["You"],
  });

  // Add Expense Form
  const [expenseForm, setExpenseForm] = React.useState({
    description: "",
    amount: "",
    paidBy: "You",
    date: today(),
    splitType: "Equally" as "Equally" | "Custom",
    customSplits: {} as Record<string, string>,
    paymentMode: "UPI",
    bankAccountId: "",
    creditCardId: "",
  });

  // Settle Up Form
  const [settleForm, setSettleForm] = React.useState({
    from: "",
    to: "",
    amount: "",
    date: today(),
    paymentMode: "UPI",
    bankAccountId: "",
  });

  // Fetch Payment Options
  const fetchPaymentOptions = React.useCallback(async () => {
    try {
      const [bankRes, ccRes] = await Promise.all([
        fetch("/api/bank-accounts"),
        fetch("/api/credit-cards"),
      ]);
      if (bankRes.ok) {
        const data = await bankRes.json();
        setBankAccounts(data.accounts);
      }
      if (ccRes.ok) {
        const data = await ccRes.json();
        setCreditCards(data.cards);
      }
    } catch (err) {
      console.error("Failed to load payment options", err);
    }
  }, []);

  React.useEffect(() => {
    void fetchPaymentOptions();
  }, [fetchPaymentOptions]);

  const loadGroupDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const detail = await fetchGroup(id);
      setSelectedGroup(detail);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to load group details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupForm.name.trim()) return toast.error("Group name is required.");
    if (groupForm.members.length < 2) return toast.error("Add at least one member to split expenses with.");

    try {
      await createGroup({
        name: groupForm.name.trim(),
        description: groupForm.description.trim() || undefined,
        members: groupForm.members,
      });
      toast.success("Group created successfully.");
      setCreateOpen(false);
      setGroupForm({ name: "", description: "", newMemberName: "", members: ["You"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create group.");
    }
  };

  const addMemberToForm = () => {
    const name = groupForm.newMemberName.trim();
    if (!name) return;
    if (groupForm.members.some((m) => m.toLowerCase() === name.toLowerCase())) {
      return toast.error("Member name already exists in group.");
    }
    setGroupForm((prev) => ({
      ...prev,
      newMemberName: "",
      members: [...prev.members, name],
    }));
  };

  const removeMemberFromForm = (index: number) => {
    const m = groupForm.members[index];
    if (m.toLowerCase() === "you") return toast.error("You cannot remove yourself from the group.");
    setGroupForm((prev) => ({
      ...prev,
      members: prev.members.filter((_, idx) => idx !== index),
    }));
  };

  // Split calculation helper
  const calculateSplitsArray = () => {
    if (!selectedGroup) return [];
    const totalAmount = Number(expenseForm.amount);
    const members = selectedGroup.group.members;
    
    if (expenseForm.splitType === "Equally") {
      const share = Number((totalAmount / members.length).toFixed(2));
      let sum = 0;
      const res = members.map((m, idx) => {
        const isLast = idx === members.length - 1;
        const currentShare = isLast ? Number((totalAmount - sum).toFixed(2)) : share;
        sum += currentShare;
        return { member: m, amount: currentShare };
      });
      return res;
    } else {
      return members.map((m) => ({
        member: m,
        amount: Number(expenseForm.customSplits[m] || 0),
      }));
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    const totalAmount = Number(expenseForm.amount);
    if (!totalAmount || totalAmount <= 0) return toast.error("Please enter a valid amount.");
    if (!expenseForm.description.trim()) return toast.error("Please enter a description.");

    const splits = calculateSplitsArray();
    const sumSplits = splits.reduce((sum, s) => sum + s.amount, 0);

    if (Math.abs(sumSplits - totalAmount) > 0.05) {
      return toast.error(`Split shares total (₹${sumSplits.toFixed(2)}) must equal total bill amount (₹${totalAmount.toFixed(2)}).`);
    }

    try {
      await addExpense(selectedGroup.group.id, {
        description: expenseForm.description.trim(),
        amount: totalAmount,
        paidBy: expenseForm.paidBy,
        date: new Date(`${expenseForm.date}T12:00:00`).toISOString(),
        splits,
        isSettlement: false,
        paymentMode: expenseForm.paidBy.toLowerCase() === "you" ? expenseForm.paymentMode : undefined,
        bankAccountId:
          expenseForm.paidBy.toLowerCase() === "you" && ["UPI", "Debit Card", "Bank Transfer"].includes(expenseForm.paymentMode)
            ? expenseForm.bankAccountId || undefined
            : undefined,
        creditCardId:
          expenseForm.paidBy.toLowerCase() === "you" && expenseForm.paymentMode === "Credit Card"
            ? expenseForm.creditCardId || undefined
            : undefined,
      });
      toast.success("Group expense added.");
      setExpenseOpen(false);
      void loadGroupDetail(selectedGroup.group.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add expense.");
    }
  };

  const handleAddSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup) return;
    const totalAmount = Number(settleForm.amount);
    if (!settleForm.from || !settleForm.to) return toast.error("Select both payer and receiver.");
    if (settleForm.from === settleForm.to) return toast.error("Payer and receiver must be different.");
    if (!totalAmount || totalAmount <= 0) return toast.error("Enter a valid amount.");

    const isUserPayer = settleForm.from.toLowerCase() === "you";
    const splits = [{ member: settleForm.to, amount: totalAmount }];

    try {
      await addExpense(selectedGroup.group.id, {
        description: `Settlement: ${settleForm.from} paid ${settleForm.to}`,
        amount: totalAmount,
        paidBy: settleForm.from,
        date: new Date(`${settleForm.date}T12:00:00`).toISOString(),
        splits,
        isSettlement: true,
        paymentMode: isUserPayer ? settleForm.paymentMode : undefined,
        bankAccountId:
          isUserPayer && ["UPI", "Debit Card", "Bank Transfer"].includes(settleForm.paymentMode)
            ? settleForm.bankAccountId || undefined
            : undefined,
      });
      toast.success("Settlement payment recorded successfully.");
      setSettleOpen(false);
      void loadGroupDetail(selectedGroup.group.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record settlement.");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this group? All splits and their associated main Expense and Lending entries will be permanently deleted and reversed.")) return;
    try {
      await deleteGroup(id);
      toast.success("Group deleted.");
      setSelectedGroup(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete group.");
    }
  };

  const initSettleUp = (from: string, to: string, amount: number) => {
    setSettleForm({
      from,
      to,
      amount: String(amount),
      date: today(),
      paymentMode: "UPI",
      bankAccountId: "",
    });
    setSettleOpen(true);
  };

  const initAddExpense = () => {
    if (!selectedGroup) return;
    setExpenseForm({
      description: "",
      amount: "",
      paidBy: "You",
      date: today(),
      splitType: "Equally",
      customSplits: selectedGroup.group.members.reduce((all, m) => {
        all[m] = "";
        return all;
      }, {} as Record<string, string>),
      paymentMode: "UPI",
      bankAccountId: "",
      creditCardId: "",
    });
    setExpenseOpen(true);
  };

  if (loading) return <PageSkeleton variant="table" />;

  // DETAIL VIEW
  if (selectedGroup) {
    const isMutatingOrLoading = mutating || detailLoading;
    const userBalance = selectedGroup.balances["You"] || selectedGroup.balances["you"] || 0;

    const memberBalancesData = selectedGroup.group.members.map((member) => {
      const balance = selectedGroup.balances[member] || 0;
      return { name: member, balance };
    }).sort((a, b) => b.balance - a.balance);

    const memberBalancesConfig = {
      balance: { label: "Balance", color: "var(--primary)" },
    } satisfies ChartConfig;

    return (
      <div className="space-y-6">
        <Button variant="ghost" className="-ml-3" onClick={() => setSelectedGroup(null)}>
          <ChevronLeft />
          All Groups
        </Button>

        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-heading text-2xl font-semibold">{selectedGroup.group.name}</h2>
            {selectedGroup.group.description && (
              <p className="mt-1 text-sm text-muted-foreground">{selectedGroup.group.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => initSettleUp("You", "", 0)}>
              <ArrowRightLeft className="size-4" />
              Settle up
            </Button>
            <Button onClick={initAddExpense}>
              <Plus />
              Add Group Expense
            </Button>
            <Button variant="destructive" size="icon" onClick={() => void handleDeleteGroup(selectedGroup.group.id)}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {/* Top Summary Card */}
        <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
          <div
            className="relative aspect-[1.62/1] overflow-hidden rounded-2xl p-5 text-white shadow-lg"
            style={{
              background:
                userBalance > 0
                  ? "linear-gradient(135deg, #0f766e, #115e59)" // positive balance: green
                  : userBalance < 0
                    ? "linear-gradient(135deg, #9f1239, #881337)" // negative balance: red
                    : "linear-gradient(135deg, #1e293b, #0f172a)", // settled: gray
            }}
          >
            <div className="absolute -right-8 -top-12 size-44 rounded-full border border-white/15" />
            <div className="absolute -bottom-20 left-10 size-44 rounded-full border border-white/10" />
            <div className="relative flex h-full flex-col">
              <div className="flex items-start justify-between">
                <Users className="size-8" />
                <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                  Group Balance
                </span>
              </div>
              <div className="mt-auto">
                <p className="text-sm text-white/70 font-medium">
                  {userBalance > 0 ? "You are owed overall" : userBalance < 0 ? "You owe overall" : "You are settled up"}
                </p>
                <MoneyText value={Math.abs(userBalance)} className="mt-1 text-3xl font-bold tracking-tight" />
                <div className="mt-4 flex justify-between text-xs uppercase tracking-wider text-white/75 font-semibold">
                  <span>Group: {selectedGroup.group.name}</span>
                  <span>{selectedGroup.group.members.length} Members</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-5 space-y-4">
            <h3 className="font-heading font-semibold">Suggested Settlements</h3>
            <div className="space-y-2 max-h-[140px] overflow-y-auto">
              {selectedGroup.suggestedSettlements.length ? (
                selectedGroup.suggestedSettlements.map((s, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted text-sm font-medium">
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{s.from}</span> pays{" "}
                      <span className="font-semibold text-foreground">{s.to}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <MoneyText value={s.amount} />
                      {((s.from.toLowerCase() === "you" || s.to.toLowerCase() === "you")) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => initSettleUp(s.from, s.to, s.amount)}
                        >
                          Settle
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-2 text-center">Everyone is fully settled up in this group!</p>
              )}
            </div>
          </div>
        </div>

        {/* Balances Section */}
        <div className="grid gap-5 md:grid-cols-3">
          <div className="md:col-span-1 space-y-5">
            <section className="card p-5">
              <h3 className="font-heading font-semibold mb-3">Group Balances</h3>
              <div className="space-y-3">
                {selectedGroup.group.members.map((member) => {
                  const bal = selectedGroup.balances[member] || 0;
                  return (
                    <div key={member} className="flex items-center justify-between text-sm py-1 border-b last:border-0 border-muted">
                      <span className="font-medium">{member}</span>
                      <span
                        className={
                          bal > 0
                            ? "text-income font-semibold"
                            : bal < 0
                              ? "text-expense font-semibold"
                              : "text-muted-foreground"
                        }
                      >
                        {bal > 0 ? "Owed " : bal < 0 ? "Owes " : ""}
                        <MoneyText value={Math.abs(bal)} />
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="card p-5">
              <h3 className="font-heading font-semibold mb-2">Balance Visualization</h3>
              <p className="text-xs text-muted-foreground mb-3">Owed (Green) vs Owes (Red)</p>
              <ChartContainer config={memberBalancesConfig} className="h-44 w-full">
                <BarChart data={memberBalancesData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={75} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="balance" radius={[0, 3, 3, 0]}>
                    {memberBalancesData.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={entry.balance > 0 ? "var(--income)" : entry.balance < 0 ? "var(--expense)" : "#94a3b8"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </section>
          </div>

          <section className="card p-5 md:col-span-2">
            <h3 className="font-heading font-semibold mb-3">Expenses Log</h3>
            <div className="overflow-x-auto max-h-[350px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedGroup.expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>{format(new Date(exp.date), "dd MMM yyyy")}</TableCell>
                      <TableCell>
                        <div className="font-medium">{exp.description}</div>
                        {exp.isSettlement && (
                          <span className="rounded-full bg-secondary/70 text-secondary-foreground px-2 py-0.5 text-3xs font-semibold uppercase tracking-wider">
                            Settlement
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{exp.paidBy}</TableCell>
                      <TableCell className="text-right font-medium">
                        <MoneyText value={exp.amount} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {!selectedGroup.expenses.length && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-12 text-center text-muted-foreground">
                        No expenses logged in this group yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        </div>

        {/* Add Group Expense Dialog */}
        <Dialog open={expenseOpen} onOpenChange={setExpenseOpen}>
          <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Group Expense</DialogTitle>
              <DialogDescription>Log a bill and split the costs between members.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={handleAddExpense}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="exp-description">Description</Label>
                  <Input
                    id="exp-description"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder="e.g. Dinner, Drinks, Cab"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="exp-amount">Total Amount (₹)</Label>
                  <Input
                    id="exp-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Paid By</Label>
                  <Select
                    value={expenseForm.paidBy}
                    onValueChange={(val) => setExpenseForm((p) => ({ ...p, paidBy: val ?? "You" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedGroup.group.members.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="exp-date">Date</Label>
                  <Input
                    id="exp-date"
                    type="date"
                    value={expenseForm.date}
                    onChange={(e) => setExpenseForm((p) => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Payment selection only if User paid */}
              {expenseForm.paidBy.toLowerCase() === "you" && (
                <div className="card p-4 bg-muted/40 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payer Account Details</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Payment Mode</Label>
                      <Select
                        value={expenseForm.paymentMode}
                        onValueChange={(val) => setExpenseForm((p) => ({ ...p, paymentMode: val ?? "UPI" }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["UPI", "Debit Card", "Credit Card", "Bank Transfer", "Cash"].map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {expenseForm.paymentMode === "Credit Card" ? (
                      <div className="grid gap-2">
                        <Label>Credit Card</Label>
                        <Select
                          value={expenseForm.creditCardId}
                          onValueChange={(val) => setExpenseForm((p) => ({ ...p, creditCardId: val ?? "" }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose card" />
                          </SelectTrigger>
                          <SelectContent>
                            {creditCards.map((card) => (
                              <SelectItem key={card.id} value={card.id}>
                                {card.name} · {card.last4Digits}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : expenseForm.paymentMode !== "Cash" ? (
                      <div className="grid gap-2">
                        <Label>Bank Account to Debit</Label>
                        <Select
                          value={expenseForm.bankAccountId}
                          onValueChange={(val) => setExpenseForm((p) => ({ ...p, bankAccountId: val ?? "" }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose account" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Split selection */}
              <div className="grid gap-2">
                <Label>Split Mode</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={expenseForm.splitType === "Equally" ? "default" : "outline"}
                    onClick={() => setExpenseForm((p) => ({ ...p, splitType: "Equally" }))}
                  >
                    Split Equally
                  </Button>
                  <Button
                    type="button"
                    variant={expenseForm.splitType === "Custom" ? "default" : "outline"}
                    onClick={() => setExpenseForm((p) => ({ ...p, splitType: "Custom" }))}
                  >
                    Custom Splits
                  </Button>
                </div>
              </div>

              {/* Custom splits fields */}
              {expenseForm.splitType === "Custom" && (
                <div className="card p-4 space-y-3 bg-muted/40 max-h-[180px] overflow-y-auto">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Individual Split Shares (₹)</h4>
                  {selectedGroup.group.members.map((member) => (
                    <div key={member} className="flex items-center gap-4">
                      <Label className="w-24 text-sm truncate">{member}</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={expenseForm.customSplits[member] || ""}
                        onChange={(e) =>
                          setExpenseForm((prev) => ({
                            ...prev,
                            customSplits: { ...prev.customSplits, [member]: e.target.value },
                          }))
                        }
                        placeholder="0.00"
                        required
                      />
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setExpenseOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <ReceiptText className="mr-1 size-4" />
                  Save Expense
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Settle Up Dialog */}
        <Dialog open={settleOpen} onOpenChange={setSettleOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Settle Debt</DialogTitle>
              <DialogDescription>Record a settlement payment between members.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={handleAddSettlement}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Who Paid (Payer)</Label>
                  <Select
                    value={settleForm.from}
                    onValueChange={(val) => setSettleForm((p) => ({ ...p, from: val ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose payer" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedGroup.group.members.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Who Received</Label>
                  <Select
                    value={settleForm.to}
                    onValueChange={(val) => setSettleForm((p) => ({ ...p, to: val ?? "" }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose receiver" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedGroup.group.members.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="settle-amount">Amount (₹)</Label>
                  <Input
                    id="settle-amount"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={settleForm.amount}
                    onChange={(e) => setSettleForm((p) => ({ ...p, amount: e.target.value }))}
                    placeholder="0.00"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="settle-date">Date</Label>
                  <Input
                    id="settle-date"
                    type="date"
                    value={settleForm.date}
                    onChange={(e) => setSettleForm((p) => ({ ...p, date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Settlement payment account selection only if User is payer */}
              {settleForm.from.toLowerCase() === "you" && (
                <div className="card p-4 bg-muted/40 space-y-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment Account Details</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Payment Mode</Label>
                      <Select
                        value={settleForm.paymentMode}
                        onValueChange={(val) => setSettleForm((p) => ({ ...p, paymentMode: val ?? "UPI" }))}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["UPI", "Debit Card", "Bank Transfer", "Cash"].map((mode) => (
                            <SelectItem key={mode} value={mode}>
                              {mode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {settleForm.paymentMode !== "Cash" && (
                      <div className="grid gap-2">
                        <Label>Bank Account to Debit</Label>
                        <Select
                          value={settleForm.bankAccountId}
                          onValueChange={(val) => setSettleForm((p) => ({ ...p, bankAccountId: val ?? "" }))}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Choose account" />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.name} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSettleOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  <CheckCircle2 className="mr-1 size-4" />
                  Record Settlement
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <LoaderOverlay show={isMutatingOrLoading} label="Saving changes..." />
      </div>
    );
  }

  // GROUP LIST VIEW
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Group Expenses</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Split bills and manage joint payments with friends, roommates, and groups.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus />
          Create Group
        </Button>
      </div>

      {groups.length ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => {
            const bal = group.userBalance ?? 0;
            return (
              <button
                key={group.id}
                onClick={() => void loadGroupDetail(group.id)}
                className="card text-left p-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all outline-none"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-heading font-semibold text-lg">{group.name}</h3>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{group.description}</p>
                    )}
                  </div>
                  <Users className="size-6 text-primary/80 shrink-0" />
                </div>
                <div className="mt-6 flex justify-between items-end border-t border-muted pt-4">
                  <div className="text-xs text-muted-foreground font-medium">
                    Members: {group.members.join(", ")}
                  </div>
                  <div className="text-right">
                    <p className="text-3xs font-semibold uppercase tracking-wider text-muted-foreground">Your Balance</p>
                    <span
                      className={`text-sm font-bold ${
                        bal > 0 ? "text-income" : bal < 0 ? "text-expense" : "text-muted-foreground"
                      }`}
                    >
                      {bal > 0 ? "+" : bal < 0 ? "-" : ""}
                      <MoneyText value={Math.abs(bal)} />
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Users />}
          title="No groups created yet"
          description="Create a group to start logging joint expenses for trips, roommates, or events."
          action={
            <Button onClick={() => setCreateOpen(true)}>
              <Plus />
              Create your first group
            </Button>
          }
        />
      )}

      {/* Create Group Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Group</DialogTitle>
            <DialogDescription>Create a group to log and divide expenses.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={handleCreateGroup}>
            <div className="grid gap-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Roommates, Trip to Mumbai, Friday Party"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="group-desc">Description (optional)</Label>
              <Input
                id="group-desc"
                value={groupForm.description}
                onChange={(e) => setGroupForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="e.g. Shared expenses for our apartment"
              />
            </div>

            <div className="grid gap-2">
              <Label>Group Members</Label>
              <div className="flex gap-2">
                <Input
                  value={groupForm.newMemberName}
                  onChange={(e) => setGroupForm((prev) => ({ ...prev, newMemberName: e.target.value }))}
                  placeholder="Member name"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addMemberToForm();
                    }
                  }}
                />
                <Button type="button" onClick={addMemberToForm}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 max-h-[100px] overflow-y-auto">
                {groupForm.members.map((m, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-muted px-2.5 py-1 rounded-full text-xs font-semibold"
                  >
                    {m}
                    {m.toLowerCase() !== "you" && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-destructive shrink-0 size-3 grid place-items-center font-bold"
                        onClick={() => removeMemberFromForm(idx)}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Group</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LoaderOverlay show={mutating} label="Loading groups..." />
    </div>
  );
}
