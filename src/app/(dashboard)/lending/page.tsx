"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  ChevronDown,
  HandCoins,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import EmptyState from "@/components/finance/EmptyState";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
import StatusBadge from "@/components/finance/StatusBadge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { type LendingEntry, type LendingInput, type BankAccountOption, useLending } from "@/hooks/useLending";
import { useSearchParams } from "next/navigation";

type EntryForm = {
  person: string;
  type: "Given" | "Taken";
  amount: string;
  date: string;
  dueDate: string;
  note: string;
  bankAccount: string;
};
type RepaymentForm = { amount: string; date: string; bankAccount: string };
const today = () => format(new Date(), "yyyy-MM-dd");
const emptyEntry = (type: "Given" | "Taken" = "Given"): EntryForm => ({
  person: "",
  type,
  amount: "",
  date: today(),
  dueDate: "",
  note: "",
  bankAccount: "",
});
const toEntryForm = (entry: LendingEntry): EntryForm => ({
  person: entry.person,
  type: entry.type,
  amount: String(entry.amount),
  date: format(new Date(entry.date), "yyyy-MM-dd"),
  dueDate: entry.dueDate ? format(new Date(entry.dueDate), "yyyy-MM-dd") : "",
  note: entry.note ?? "",
  bankAccount: entry.bankAccount ?? "",
});
const emptyRepayment = (): RepaymentForm => ({ amount: "", date: today(), bankAccount: "" });

export default function LendingPage() {
  const { lending, bankAccounts, isLoading, isMutating, create, update, remove, repay } = useLending();
  const [tab, setTab] = React.useState<"Given" | "Taken" | "History">("Given");
  const [entryOpen, setEntryOpen] = React.useState(false);
  const [repaymentOpen, setRepaymentOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<LendingEntry | null>(null);
  const [repaying, setRepaying] = React.useState<LendingEntry | null>(null);
  const [entryForm, setEntryForm] = React.useState<EntryForm>(emptyEntry());
  const [repaymentForm, setRepaymentForm] = React.useState<RepaymentForm>(emptyRepayment());
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (searchParams.get("add") === "true") {
      openCreate();
    }
  }, [searchParams]);

  const entries = React.useMemo(() => {
    return lending.filter((entry) => entry.type === (tab === "History" ? "Given" : tab));
  }, [lending, tab]);

  const total = React.useMemo(() => entries.reduce((sum, entry) => sum + entry.amount, 0), [entries]);
  const pending = React.useMemo(() => entries.reduce((sum, entry) => sum + entry.amount - entry.amountReturned, 0), [entries]);

  const groups = React.useMemo(
    () =>
      Object.values(
        entries.reduce<Record<string, LendingEntry[]>>((all, entry) => {
          (all[entry.person] ??= []).push(entry);
          return all;
        }, {})
      ).sort((a, b) => a[0].person.localeCompare(b[0].person)),
    [entries]
  );

  const repaymentHistory = React.useMemo(() => {
    return lending
      .flatMap((entry) =>
        (entry.repayments || []).map((rep) => ({
          id: rep.id,
          person: entry.person,
          type: entry.type,
          amount: rep.amount,
          date: rep.date,
          bankAccount: rep.bankAccount,
          entryNote: entry.note,
        }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [lending]);

  const lendingChartData = React.useMemo(() => {
    return groups
      .map((group) => {
        const person = group[0].person;
        const totalAmount = group.reduce((sum, entry) => sum + entry.amount, 0);
        const returned = group.reduce((sum, entry) => sum + entry.amountReturned, 0);
        const remaining = totalAmount - returned;
        return { name: person, pending: remaining };
      })
      .filter((item) => item.pending > 0)
      .sort((a, b) => b.pending - a.pending)
      .slice(0, 6);
  }, [groups]);

  const lendingChartConfig = {
    pending: { label: "Pending Balance", color: tab === "Given" ? "var(--income)" : "var(--expense)" },
  } satisfies ChartConfig;

  const setEntry = <K extends keyof EntryForm>(key: K, value: EntryForm[K]) =>
    setEntryForm((current) => ({ ...current, [key]: value }));
  const setRepayment = <K extends keyof RepaymentForm>(key: K, value: RepaymentForm[K]) =>
    setRepaymentForm((current) => ({ ...current, [key]: value }));
  function openCreate() {
    setEditing(null);
    setEntryForm(emptyEntry(tab === "History" ? "Given" : tab));
    setEntryOpen(true);
  }
  function openEdit(entry: LendingEntry) {
    setEditing(entry);
    setEntryForm(toEntryForm(entry));
    setEntryOpen(true);
  }
  function openRepayment(entry: LendingEntry) {
    setRepaying(entry);
    setRepaymentForm(emptyRepayment());
    setRepaymentOpen(true);
  }
  function toggle(person: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(person)) next.delete(person);
      else next.add(person);
      return next;
    });
  }
  async function submitEntry(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(entryForm.amount);
    if (!entryForm.person.trim()) return toast.error("Enter a person's name.");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error("Enter a valid amount.");
    const payload: LendingInput = {
      person: entryForm.person.trim(),
      type: entryForm.type,
      amount,
      date: new Date(`${entryForm.date}T12:00:00`).toISOString(),
      dueDate: entryForm.dueDate ? new Date(`${entryForm.dueDate}T12:00:00`).toISOString() : null,
      note: entryForm.note.trim() || undefined,
      bankAccount: entryForm.bankAccount || undefined,
    };
    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Entry updated.");
      } else {
        await create(payload);
        toast.success("Entry added.");
      }
      setEntryOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save entry.");
    }
  }
  async function submitRepayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!repaying) return;
    const amount = Number(repaymentForm.amount);
    const pendingAmount = repaying.amount - repaying.amountReturned;
    if (!Number.isFinite(amount) || amount <= 0 || amount > pendingAmount)
      return toast.error(`Enter an amount up to ${pendingAmount}.`);
    try {
      await repay(repaying.id, {
        amount,
        date: new Date(`${repaymentForm.date}T12:00:00`).toISOString(),
        bankAccount: repaymentForm.bankAccount || undefined,
      });
      toast.success("Repayment recorded.");
      setRepaymentOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record repayment.");
    }
  }
  async function deleteEntry(entry: LendingEntry) {
    if (!window.confirm(`Delete the entry with ${entry.person}?`)) return;
    try {
      await remove(entry.id);
      toast.success("Entry deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete entry.");
    }
  }
  if (isLoading) return <PageSkeleton variant="table" />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Lending</h2>
          <p className="mt-1 text-sm text-muted-foreground">Keep a clear record of money lent and borrowed.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add Entry
        </Button>
      </div>
      <Tabs value={tab} onValueChange={(value) => setTab(value as "Given" | "Taken" | "History")}>
        <TabsList>
          <TabsTrigger value="Given">
            <ArrowUpFromLine />
            Money I Gave
          </TabsTrigger>
          <TabsTrigger value="Taken">
            <ArrowDownToLine />
            Money I Owe
          </TabsTrigger>
          <TabsTrigger value="History">
            <RotateCcw />
            Repayments History
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {tab !== "History" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1.5fr] items-stretch">
          <div className="grid gap-4">
            <StatCard icon={<HandCoins />} label={tab === "Given" ? "Total Given" : "Total Taken"} value={total} />
            <StatCard
              icon={<RotateCcw />}
              label={tab === "Given" ? "Pending to Receive" : "Pending to Pay"}
              value={pending}
            />
          </div>
          {lendingChartData.length > 0 && (
            <div className="card p-5 flex flex-col justify-between">
              <div>
                <h3 className="font-heading text-sm font-semibold">
                  {tab === "Given" ? "Top Borrowers" : "Top Lenders"}
                </h3>
                <p className="text-xs text-muted-foreground">Pending balances per person</p>
              </div>
              <ChartContainer config={lendingChartConfig} className="h-32 w-full mt-3">
                <BarChart data={lendingChartData} layout="vertical" margin={{ left: -10, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" width={90} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="pending"
                    fill={tab === "Given" ? "var(--income)" : "var(--expense)"}
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </div>
      )}
      {tab === "History" ? (
        <RepaymentHistoryList repayments={repaymentHistory} bankAccounts={bankAccounts} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon={<HandCoins />}
          title={`No ${tab === "Given" ? "lending" : "borrowed-money"} records yet`}
          description={`Add an entry to start tracking ${tab === "Given" ? "what people owe you" : "what you owe others"}.`}
          action={
            <Button onClick={openCreate}>
              <Plus />
              Add your first entry
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {groups.map((personEntries) => {
            const person = personEntries[0].person;
            const amount = personEntries.reduce((sum, entry) => sum + entry.amount, 0);
            const returned = personEntries.reduce((sum, entry) => sum + entry.amountReturned, 0);
            const remaining = amount - returned;
            const status = remaining === 0 ? "Settled" : returned > 0 ? "Partially Returned" : "Pending";
            const isExpanded = expanded.has(person);
            return (
              <section key={person} className="card overflow-hidden">
                <button
                  className="flex w-full items-center gap-4 p-4 text-left hover:bg-muted/30"
                  onClick={() => toggle(person)}
                  aria-expanded={isExpanded}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                    {person.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{person}</div>
                    <div className="text-sm text-muted-foreground">
                      {personEntries.length} {personEntries.length === 1 ? "entry" : "entries"}
                    </div>
                  </div>
                  <div className="hidden text-right sm:block">
                    <div className="text-xs text-muted-foreground">Total</div>
                    <MoneyText value={amount} className="font-medium text-sm" />
                  </div>
                  <div className="hidden text-right md:block">
                    <div className="text-xs text-muted-foreground">Returned</div>
                    <MoneyText value={returned} className="text-sm" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">
                      {tab === "Given" ? "Left to Take" : "Left to Pay"}
                    </div>
                    <MoneyText value={remaining} className="font-semibold text-sm sm:text-base" />
                  </div>
                  <StatusBadge status={status} />
                  <ChevronDown className={`shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <div className="border-t border-border px-4 py-2 space-y-3">
                    <div className="flex justify-end pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditing(null);
                          setEntryForm({
                            person,
                            type: tab === "Taken" ? "Taken" : "Given",
                            amount: "",
                            date: today(),
                            dueDate: "",
                            note: "",
                            bankAccount: "",
                          });
                          setEntryOpen(true);
                        }}
                      >
                        <Plus className="mr-1.5 size-4" />
                        {tab === "Given" ? "Lend More" : "Borrow More"}
                      </Button>
                    </div>
                    {personEntries.map((entry) => (
                      <div
                        key={entry.id}
                        className="flex flex-col gap-3 border-b border-border py-3 last:border-0 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              <MoneyText value={entry.amount} />
                            </span>
                            <StatusBadge status={entry.status} />
                          </div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {format(new Date(entry.date), "dd MMM yyyy")}
                            {entry.dueDate ? ` · Due ${format(new Date(entry.dueDate), "dd MMM yyyy")}` : ""}
                            {entry.note ? ` · ${entry.note}` : ""}
                          </div>
                          {/* Repayments log */}
                          {entry.repayments && entry.repayments.length > 0 && (
                            <div className="mt-3 pl-3 border-l-2 border-primary/20 space-y-1">
                              <div className="text-xs font-semibold text-muted-foreground">Repayments:</div>
                              {entry.repayments.map((rep) => {
                                const account = rep.bankAccount
                                  ? bankAccounts.find((a) => a.id === rep.bankAccount)
                                  : null;
                                return (
                                  <div
                                    key={rep.id}
                                    className="text-xs text-muted-foreground flex items-center justify-between gap-4 max-w-[280px]"
                                  >
                                    <span>
                                      {format(new Date(rep.date), "dd MMM yyyy")}
                                      {account ? ` (${account.name})` : ""}
                                    </span>
                                    <span className="font-medium text-foreground">
                                      <MoneyText value={rep.amount} />
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-x-5 text-sm sm:block sm:text-right">
                          <span className="text-muted-foreground sm:block">Returned</span>
                          <MoneyText value={entry.amountReturned} />
                          <span className="text-muted-foreground sm:mt-1 sm:block">Pending</span>
                          <MoneyText value={entry.amount - entry.amountReturned} />
                        </div>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={entry.status === "Settled"}
                                  onClick={() => openRepayment(entry)}
                                />
                              }
                            >
                              <RotateCcw />
                              {entry.type === "Given" ? "Record Return" : "Pay Back"}
                            </TooltipTrigger>
                            <TooltipContent>
                              {entry.type === "Given" ? "Record money returned to you" : "Record repayment to lender"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  onClick={() => openEdit(entry)}
                                  aria-label="Edit entry"
                                />
                              }
                            >
                              <Pencil />
                            </TooltipTrigger>
                            <TooltipContent>Edit entry</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  size="icon-sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => void deleteEntry(entry)}
                                  aria-label="Delete entry"
                                />
                              }
                            >
                              <Trash2 />
                            </TooltipTrigger>
                            <TooltipContent>Delete entry</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
      <Dialog open={entryOpen} onOpenChange={setEntryOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit entry" : "Add lending entry"}</DialogTitle>
            <DialogDescription>Record money you gave someone or borrowed from them.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitEntry}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="lending-person">Person</Label>
                <Input
                  id="lending-person"
                  value={entryForm.person}
                  onChange={(event) => setEntry("person", event.target.value)}
                  placeholder="Name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={entryForm.type}
                  onValueChange={(value) => setEntry("type", (value ?? "Given") as EntryForm["type"])}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{entryForm.type === "Given" ? "Money I gave" : "Money I owe"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Given">Money I gave</SelectItem>
                    <SelectItem value="Taken">Money I owe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="lending-amount">Amount</Label>
                <Input
                  id="lending-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={entryForm.amount}
                  onChange={(event) => setEntry("amount", event.target.value)}
                  required
                />
              </div>
              <DateInput label="Date" value={entryForm.date} onChange={(value) => setEntry("date", value)} />
            </div>
            <DateInput
              label="Due date (optional)"
              value={entryForm.dueDate}
              onChange={(value) => setEntry("dueDate", value)}
              optional
            />
            <div className="grid gap-2">
              <Label>
                {entryForm.type === "Given" ? "Pay from Bank Account" : "Deposit to Bank Account"}{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={entryForm.bankAccount || "none"}
                onValueChange={(value) => setEntry("bankAccount", value === "none" ? "" : (value ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No bank account">
                    {entryForm.bankAccount
                      ? bankAccounts.find((account) => account.id === entryForm.bankAccount)?.name +
                        (bankAccounts.find((account) => account.id === entryForm.bankAccount)?.last4Digits
                          ? ` · ${bankAccounts.find((account) => account.id === entryForm.bankAccount)?.last4Digits}`
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
            <div className="grid gap-2">
              <Label htmlFor="lending-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="lending-note"
                value={entryForm.note}
                onChange={(event) => setEntry("note", event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEntryOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Add entry"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={repaymentOpen} onOpenChange={setRepaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {repaying?.type === "Given" ? "Record Return of Money" : "Record Repayment"}
            </DialogTitle>
            <DialogDescription>
              {repaying
                ? repaying.type === "Given"
                  ? `${repaying.person} has ${repaying.amount - repaying.amountReturned} remaining to pay you.`
                  : `You have ${repaying.amount - repaying.amountReturned} remaining to pay ${repaying.person}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitRepayment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="repayment-amount">Amount</Label>
                <Input
                  id="repayment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={repaymentForm.amount}
                  onChange={(event) => setRepayment("amount", event.target.value)}
                  required
                />
              </div>
              <DateInput label="Date" value={repaymentForm.date} onChange={(value) => setRepayment("date", value)} />
            </div>
            <div className="grid gap-2">
              <Label>
                {repaying?.type === "Given" ? "Deposit to Bank Account" : "Pay from Bank Account"}{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select
                value={repaymentForm.bankAccount || "none"}
                onValueChange={(value) => setRepayment("bankAccount", value === "none" ? "" : (value ?? ""))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No bank account">
                    {repaymentForm.bankAccount
                      ? bankAccounts.find((account) => account.id === repaymentForm.bankAccount)?.name +
                        (bankAccounts.find((account) => account.id === repaymentForm.bankAccount)?.last4Digits
                          ? ` · ${bankAccounts.find((account) => account.id === repaymentForm.bankAccount)?.last4Digits}`
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
              <Button type="button" variant="outline" onClick={() => setRepaymentOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                {repaying?.type === "Given" ? "Record Return" : "Record Repayment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <LoaderOverlay show={isMutating} label="Updating lending records..." />
    </div>
  );
}

function DateInput({
  label,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const selected = value ? new Date(`${value}T12:00:00`) : undefined;
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <Popover>
        <PopoverTrigger
          render={<Button type="button" variant="outline" className="w-full justify-start font-normal" />}
        >
          <CalendarDays />
          {selected ? format(selected, "dd MMM yyyy") : "Choose date"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={selected}
            onSelect={(date) => onChange(date ? format(date, "yyyy-MM-dd") : "")}
          />
        </PopoverContent>
      </Popover>
      {optional && value && (
        <button
          type="button"
          className="w-fit text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange("")}
        >
          Clear due date
        </button>
      )}
    </div>
  );
}

function RepaymentHistoryList({
  repayments,
  bankAccounts,
}: {
  repayments: any[];
  bankAccounts: BankAccountOption[];
}) {
  return (
    <div className="card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Person</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Bank Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {repayments.map((item) => {
            const account = item.bankAccount
              ? bankAccounts.find((a) => a.id === item.bankAccount)
              : null;
            return (
              <TableRow key={item.id}>
                <TableCell>{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                <TableCell className="font-medium">{item.person}</TableCell>
                <TableCell>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      item.type === "Given"
                        ? "bg-income-10 text-income"
                        : "bg-expense-10 text-expense"
                    }`}
                  >
                    {item.type === "Given" ? "Returned to you" : "Returned to them"}
                  </span>
                </TableCell>
                <TableCell>
                  {account ? (
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">
                      {account.name} {account.last4Digits ? `(•••• ${account.last4Digits})` : ""}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <MoneyText
                    value={item.amount}
                    variant={item.type === "Given" ? "positive" : "negative"}
                  />
                </TableCell>
              </TableRow>
            );
          })}
          {!repayments.length && (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No repayments recorded yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
