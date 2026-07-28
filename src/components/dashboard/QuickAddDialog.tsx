"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarDays, CircleDollarSign, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

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
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

type EntryType = "expense" | "income" | "investment" | "lending";

const EXPENSE_PAYMENT_MODES = ["Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer"] as const;
const INCOME_PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Other"] as const;
const INVESTMENT_TYPES = ["Mutual Fund", "Stocks", "FD", "RD", "Gold", "Crypto", "PPF", "Other"] as const;

export default function QuickAddDialog({ open, onOpenChange, onSuccess }: Props) {
  const [activeTab, setActiveTab] = React.useState<EntryType>("expense");
  const [loading, setLoading] = React.useState(false);

  // Form State
  const [amount, setAmount] = React.useState("");
  const [source, setSource] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [date, setDate] = React.useState(format(new Date(), "yyyy-MM-dd"));
  const [paymentMode, setPaymentMode] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [creditCard, setCreditCard] = React.useState("");
  const [note, setNote] = React.useState("");
  
  // Investment State
  const [investmentType, setInvestmentType] = React.useState("Mutual Fund");
  const [investmentName, setInvestmentName] = React.useState("");
  const [currentValue, setCurrentValue] = React.useState("");

  // Lending State
  const [person, setPerson] = React.useState("");
  const [lendingType, setLendingType] = React.useState<"Given" | "Taken">("Given");
  const [dueDate, setDueDate] = React.useState("");

  // Lists fetched from APIs
  const [categories, setCategories] = React.useState<{ id: string; name: string; type: string }[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<{ id: string; name: string; last4Digits?: string }[]>([]);
  const [creditCards, setCreditCards] = React.useState<{ id: string; name: string; last4Digits: string }[]>([]);

  // Fetch helper lists on mount/open
  React.useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const [catRes, bankRes, ccRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/bank-accounts"),
          fetch("/api/credit-cards"),
        ]);
        if (catRes.ok) {
          const data = await catRes.json();
          setCategories(data.categories);
        }
        if (bankRes.ok) {
          const data = await bankRes.json();
          setBankAccounts(data.accounts);
        }
        if (ccRes.ok) {
          const data = await ccRes.json();
          setCreditCards(data.cards);
        }
      } catch (err) {
        console.error("Failed to load options", err);
      }
    })();
  }, [open]);

  // Reset state when tab changes
  React.useEffect(() => {
    setAmount("");
    setSource("");
    setNote("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setBankAccount("");
    setCreditCard("");
    setCategory("");
    setPaymentMode("");
    setInvestmentName("");
    setInvestmentType("Mutual Fund");
    setCurrentValue("");
    setPerson("");
    setLendingType("Given");
    setDueDate("");
  }, [activeTab]);

  // Filter Categories
  const filteredCategories = React.useMemo(() => {
    const typeKey = activeTab === "expense" ? "Expense" : "Income";
    return categories.filter((c) => c.type === typeKey).map((c) => c.name);
  }, [categories, activeTab]);

  // Auto-fill default category when list loads
  React.useEffect(() => {
    if (filteredCategories.length > 0 && !category) {
      setCategory(filteredCategories[0]);
    }
  }, [filteredCategories, category]);

  // Set default payment mode
  React.useEffect(() => {
    if (activeTab === "expense") {
      setPaymentMode("UPI");
    } else if (activeTab === "income") {
      setPaymentMode("Bank Transfer");
    }
  }, [activeTab]);

  const showBankAccount = activeTab === "expense" 
    ? ["UPI", "Debit Card", "Bank Transfer"].includes(paymentMode)
    : activeTab === "income" || activeTab === "lending";
  const showCreditCard = activeTab === "expense" && paymentMode === "Credit Card";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error("Please enter a valid amount.");
      return;
    }

    setLoading(true);
    try {
      let url = "";
      let payload: Record<string, any> = {};

      const isoDate = new Date(`${date}T12:00:00`).toISOString();

      if (activeTab === "expense") {
        url = "/api/expenses";
        payload = {
          amount: numAmount,
          source: source.trim() || undefined,
          category,
          date: isoDate,
          paymentMode,
          bankAccount: showBankAccount ? bankAccount || null : null,
          creditCard: showCreditCard ? creditCard || null : null,
          note: note.trim() || undefined,
        };
        if (showBankAccount && !bankAccount) throw new Error("Please select a bank account to debit.");
        if (showCreditCard && !creditCard) throw new Error("Please select a credit card.");
      } else if (activeTab === "income") {
        url = "/api/income";
        payload = {
          amount: numAmount,
          source: source.trim(),
          category: category || undefined,
          date: isoDate,
          paymentMode,
          bankAccount: bankAccount || null,
          note: note.trim() || undefined,
        };
        if (!source.trim()) throw new Error("Please enter a source.");
      } else if (activeTab === "investment") {
        url = "/api/investments";
        payload = {
          type: investmentType,
          name: investmentName.trim() || undefined,
          amountInvested: numAmount,
          currentValue: currentValue ? Number(currentValue) : numAmount,
          date: isoDate,
          note: note.trim() || undefined,
        };
      } else if (activeTab === "lending") {
        url = "/api/lending";
        payload = {
          person: person.trim(),
          type: lendingType,
          amount: numAmount,
          date: isoDate,
          dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
          note: note.trim() || undefined,
          bankAccount: bankAccount || null,
        };
        if (!person.trim()) throw new Error("Please enter the name of the person.");
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save entry.");

      toast.success(`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} entry added successfully.`);
      onSuccess();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Add Entry</DialogTitle>
          <DialogDescription>
            Insert any financial transaction directly from your dashboard.
          </DialogDescription>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-muted p-1 text-sm font-medium">
          {(["expense", "income", "investment", "lending"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              type="button"
              className={cn(
                "rounded-md py-1.5 transition-all text-center capitalize select-none outline-none",
                activeTab === tab
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 mt-2">
          {/* Amount Field (Common) */}
          <div className="grid gap-2">
            <Label htmlFor="quick-amount">Amount (₹)</Label>
            <Input
              id="quick-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
            />
          </div>

          {/* Type-Specific Form Sections */}
          {activeTab === "expense" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="expense-source">Source / Payee</Label>
                  <Input
                    id="expense-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Merchant, store name..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(val) => setCategory(val ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{category}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={(val) => setPaymentMode(val ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{paymentMode}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
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
                      {format(new Date(`${date}T12:00:00`), "dd MMM yyyy")}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(`${date}T12:00:00`)}
                        onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {showBankAccount && (
                <div className="grid gap-2">
                  <Label>Bank Account to Debit</Label>
                  <Select value={bankAccount} onValueChange={(val) => setBankAccount(val ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a bank account">
                        {bankAccount
                          ? bankAccounts.find((a) => a.id === bankAccount)?.name +
                            (bankAccounts.find((a) => a.id === bankAccount)?.last4Digits
                              ? ` · ${bankAccounts.find((a) => a.id === bankAccount)?.last4Digits}`
                              : "")
                          : undefined}
                      </SelectValue>
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

              {showCreditCard && (
                <div className="grid gap-2">
                  <Label>Credit Card to Charge</Label>
                  <Select value={creditCard} onValueChange={(val) => setCreditCard(val ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a credit card">
                        {creditCard
                          ? creditCards.find((c) => c.id === creditCard)?.name +
                            ` · ${creditCards.find((c) => c.id === creditCard)?.last4Digits}`
                          : undefined}
                      </SelectValue>
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
              )}
            </>
          )}

          {activeTab === "income" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="income-source">Income Source</Label>
                  <Input
                    id="income-source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Employer, freelance client..."
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Category</Label>
                  <Select value={category} onValueChange={(val) => setCategory(val ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{category}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={(val) => setPaymentMode(val ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{paymentMode}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {INCOME_PAYMENT_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {mode}
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
                      {format(new Date(`${date}T12:00:00`), "dd MMM yyyy")}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(`${date}T12:00:00`)}
                        onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Bank Account to Credit <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select value={bankAccount} onValueChange={(val) => setBankAccount(val ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No linked account">
                      {bankAccount
                        ? bankAccounts.find((a) => a.id === bankAccount)?.name +
                          (bankAccounts.find((a) => a.id === bankAccount)?.last4Digits
                            ? ` · ${bankAccounts.find((a) => a.id === bankAccount)?.last4Digits}`
                            : "")
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No linked account</SelectItem>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {activeTab === "investment" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Investment Type</Label>
                  <Select value={investmentType} onValueChange={(val) => setInvestmentType(val ?? "Mutual Fund")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{investmentType}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {INVESTMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="investment-name">Asset / Fund Name</Label>
                  <Input
                    id="investment-name"
                    value={investmentName}
                    onChange={(e) => setInvestmentName(e.target.value)}
                    placeholder="e.g. HDFC Index Fund"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="current-value">Current Value <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="current-value"
                    type="number"
                    min="0"
                    step="0.01"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                    placeholder="Defaults to invested amount"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                      <CalendarDays />
                      {format(new Date(`${date}T12:00:00`), "dd MMM yyyy")}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(`${date}T12:00:00`)}
                        onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </>
          )}

          {activeTab === "lending" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="lending-person">Person Name</Label>
                  <Input
                    id="lending-person"
                    value={person}
                    onChange={(e) => setPerson(e.target.value)}
                    placeholder="Enter name"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Lending Flow</Label>
                  <Select value={lendingType} onValueChange={(val) => setLendingType((val ?? "Given") as "Given" | "Taken")}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{lendingType === "Given" ? "Lent Money" : "Borrowed Money"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Given">Lent Money</SelectItem>
                      <SelectItem value="Taken">Borrowed Money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                      <CalendarDays />
                      {format(new Date(`${date}T12:00:00`), "dd MMM yyyy")}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(`${date}T12:00:00`)}
                        onSelect={(d) => d && setDate(format(d, "yyyy-MM-dd"))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid gap-2">
                  <Label>Due Date <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                      <CalendarDays />
                      {dueDate ? format(new Date(`${dueDate}T12:00:00`), "dd MMM yyyy") : "Choose a due date"}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dueDate ? new Date(`${dueDate}T12:00:00`) : undefined}
                        onSelect={(d) => setDueDate(d ? format(d, "yyyy-MM-dd") : "")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Bank Account <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Select value={bankAccount} onValueChange={(val) => setBankAccount(val ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No bank account">
                      {bankAccount
                        ? bankAccounts.find((a) => a.id === bankAccount)?.name +
                          (bankAccounts.find((a) => a.id === bankAccount)?.last4Digits
                            ? ` · ${bankAccounts.find((a) => a.id === bankAccount)?.last4Digits}`
                            : "")
                        : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No bank account</SelectItem>
                    {bankAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {/* Notes (Common except Lending where it is optional, we make it general optional) */}
          <div className="grid gap-2">
            <Label htmlFor="quick-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="quick-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add details/tags..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
              Save Entry
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
