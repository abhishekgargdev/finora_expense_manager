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
import {
  calculateMaturityDate,
  calculateLumpsumMaturity,
  calculateRecurringMaturity,
} from "@/lib/investment-calculations";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

type EntryType = "expense" | "income" | "investment" | "lending";

const EXPENSE_PAYMENT_MODES = ["Cash", "UPI", "Debit Card", "Credit Card", "Bank Transfer"] as const;
const INCOME_PAYMENT_MODES = ["Cash", "Bank Transfer", "UPI", "Other"] as const;
const MARKET_INVESTMENT_TYPES = ["Mutual Fund", "Stocks", "Gold", "Crypto", "Other"] as const;
const FIXED_INVESTMENT_TYPES = ["FD", "RD", "PPF", "NPS", "Bonds", "Bank RD Plan", "Other"] as const;

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

  // Enhanced Investment State for Fixed-Tenure
  const [investmentCategory, setInvestmentCategory] = React.useState<"Market-Linked" | "Fixed-Tenure">("Market-Linked");
  const [investmentMode, setInvestmentMode] = React.useState<"Lumpsum" | "Recurring">("Lumpsum");
  const [institution, setInstitution] = React.useState("");
  const [planName, setPlanName] = React.useState("");
  const [accountOrPolicyNumber, setAccountOrPolicyNumber] = React.useState("");
  const [interestRate, setInterestRate] = React.useState("");
  const [compoundingFrequency, setCompoundingFrequency] = React.useState<"Monthly" | "Quarterly" | "Half-Yearly" | "Annually" | "At Maturity">("Quarterly");
  const [installmentFrequency, setInstallmentFrequency] = React.useState<"Monthly" | "Quarterly">("Monthly");
  const [tenureValue, setTenureValue] = React.useState("");
  const [tenureUnit, setTenureUnit] = React.useState<"Months" | "Years">("Months");
  const [expectedMaturityAmount, setExpectedMaturityAmount] = React.useState("");
  const [maturityDate, setMaturityDate] = React.useState("");

  // Lending State
  const [person, setPerson] = React.useState("");
  const [lendingType, setLendingType] = React.useState<"Given" | "Taken">("Given");
  const [dueDate, setDueDate] = React.useState("");

  // Lists fetched from APIs
  const [categories, setCategories] = React.useState<{ id: string; name: string; type: string }[]>([]);
  const [bankAccounts, setBankAccounts] = React.useState<{ id: string; bankName: string; accountName?: string; last4Digits?: string }[]>([]);
  const [creditCards, setCreditCards] = React.useState<{ id: string; name: string; last4Digits: string }[]>([]);

  const getBankAccountLabel = React.useCallback((acc?: { bankName: string; accountName?: string }) => {
    if (!acc) return "";
    return acc.accountName ? `${acc.bankName} (${acc.accountName})` : acc.bankName;
  }, []);

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

    // Enhanced Investment resets
    setInvestmentCategory("Market-Linked");
    setInvestmentMode("Lumpsum");
    setInstitution("");
    setPlanName("");
    setAccountOrPolicyNumber("");
    setInterestRate("");
    setCompoundingFrequency("Quarterly");
    setInstallmentFrequency("Monthly");
    setTenureValue("");
    setTenureUnit("Months");
    setExpectedMaturityAmount("");
    setMaturityDate("");
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
    : activeTab === "income" || activeTab === "lending" || (activeTab === "investment" && investmentCategory === "Fixed-Tenure" && investmentMode === "Lumpsum");
  const showCreditCard = activeTab === "expense" && paymentMode === "Credit Card";

  // Live preview logic for Fixed-Tenure
  let previewMaturityDateStr = "";
  let previewExpectedMaturityVal = 0;

  if (activeTab === "investment" && investmentCategory === "Fixed-Tenure") {
    const start = new Date(date);
    const tenureVal = Number(tenureValue);
    const rate = Number(interestRate);

    if (!Number.isNaN(start.getTime()) && Number.isFinite(tenureVal) && tenureVal > 0) {
      const matDate = calculateMaturityDate(start, tenureVal, tenureUnit);
      previewMaturityDateStr = format(matDate, "dd MMM yyyy");

      if (Number.isFinite(rate) && rate >= 0) {
        if (investmentMode === "Lumpsum") {
          const principal = Number(amount);
          if (Number.isFinite(principal) && principal > 0) {
            previewExpectedMaturityVal = calculateLumpsumMaturity(
              principal,
              rate,
              start,
              matDate,
              compoundingFrequency
            );
          }
        } else {
          const installment = Number(amount);
          if (Number.isFinite(installment) && installment > 0) {
            const tenureInMonths = tenureUnit === "Years" ? tenureVal * 12 : tenureVal;
            const totalInstallments =
              installmentFrequency === "Quarterly" ? Math.round(tenureInMonths / 3) : tenureInMonths;

            previewExpectedMaturityVal = calculateRecurringMaturity(
              installment,
              rate,
              installmentFrequency,
              totalInstallments
            );
          }
        }
      }
    }
  }

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
        
        if (investmentCategory === "Market-Linked") {
          payload = {
            category: "Market-Linked",
            type: investmentType,
            name: investmentName.trim() || undefined,
            amountInvested: numAmount,
            currentValue: currentValue ? Number(currentValue) : numAmount,
            date: isoDate,
            note: note.trim() || undefined,
          };
        } else {
          // Fixed-Tenure
          const rate = Number(interestRate);
          const tenureVal = Number(tenureValue);
          if (!Number.isFinite(rate) || rate < 0) throw new Error("Please enter a valid interest rate.");
          if (!Number.isFinite(tenureVal) || tenureVal <= 0) throw new Error("Please enter a valid tenure value.");
          if (!institution.trim()) throw new Error("Institution (Bank/Issuer) is required.");

          payload = {
            category: "Fixed-Tenure",
            type: investmentType,
            institution: institution.trim(),
            planName: planName.trim() || undefined,
            accountOrPolicyNumber: accountOrPolicyNumber.trim() || undefined,
            investmentMode,
            interestRate: rate,
            compoundingFrequency,
            startDate: isoDate,
            date: isoDate,
            tenureValue: tenureVal,
            tenureUnit,
            bankAccount: (investmentMode === "Lumpsum" && bankAccount && bankAccount !== "none") ? bankAccount : undefined,
            note: note.trim() || undefined,
          };

          if (currentValue) {
            payload.currentValue = Number(currentValue);
          }

          if (investmentMode === "Lumpsum") {
            payload.principalAmount = numAmount;
            payload.amountInvested = numAmount;
          } else {
            payload.installmentAmount = numAmount;
            payload.installmentFrequency = installmentFrequency;
          }

          if (expectedMaturityAmount) {
            payload.expectedMaturityAmount = Number(expectedMaturityAmount);
          }
          if (maturityDate) {
            payload.maturityDate = new Date(`${maturityDate}T12:00:00`).toISOString();
          }
        }
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
            <Label htmlFor="quick-amount">
              {activeTab === "investment" && investmentCategory === "Fixed-Tenure"
                ? investmentMode === "Lumpsum"
                  ? "Principal Amount (₹)"
                  : "Installment Amount (₹)"
                : "Amount (₹)"}
            </Label>
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
                      <CalendarDays className="size-4 mr-2" />
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
                          ? getBankAccountLabel(bankAccounts.find((a) => a.id === bankAccount)) +
                            (bankAccounts.find((a) => a.id === bankAccount)?.last4Digits
                              ? ` · ${bankAccounts.find((a) => a.id === bankAccount)?.last4Digits}`
                              : "")
                          : undefined}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          {getBankAccountLabel(acc)} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
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
                      <CalendarDays className="size-4 mr-2" />
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
                        ? getBankAccountLabel(bankAccounts.find((a) => a.id === bankAccount)) +
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
                        {getBankAccountLabel(acc)} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {activeTab === "investment" && (
            <>
              {/* Category Select */}
              <div className="grid gap-2">
                <Label>Category</Label>
                <Select
                  value={investmentCategory}
                  onValueChange={(val) => {
                    const cat = val as "Market-Linked" | "Fixed-Tenure";
                    setInvestmentCategory(cat);
                    setInvestmentType(cat === "Market-Linked" ? "Mutual Fund" : "FD");
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>{investmentCategory}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Market-Linked">Market-Linked (Stocks, MFs, Gold, Crypto)</SelectItem>
                    <SelectItem value="Fixed-Tenure">Fixed-Tenure (FD, RD, PPF, NPS, Bonds)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {investmentCategory === "Market-Linked" ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Investment Type</Label>
                      <Select value={investmentType} onValueChange={(val) => setInvestmentType(val ?? "Mutual Fund")}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{investmentType}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {MARKET_INVESTMENT_TYPES.map((type) => (
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
                          <CalendarDays className="size-4 mr-2" />
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
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Investment Type</Label>
                      <Select value={investmentType} onValueChange={(val) => setInvestmentType(val ?? "FD")}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{investmentType}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {FIXED_INVESTMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="institution">Institution (Bank/Issuer) *</Label>
                      <Input
                        id="institution"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="e.g. HDFC Bank, SBI"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="plan-name">Plan Name</Label>
                      <Input
                        id="plan-name"
                        value={planName}
                        onChange={(e) => setPlanName(e.target.value)}
                        placeholder="e.g. Regular FD, iWish RD"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="policy-number">Reference / Account #</Label>
                      <Input
                        id="policy-number"
                        value={accountOrPolicyNumber}
                        onChange={(e) => setAccountOrPolicyNumber(e.target.value)}
                        placeholder="e.g. FD123456"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Investment Mode</Label>
                      <Select value={investmentMode} onValueChange={(val) => setInvestmentMode(val as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{investmentMode}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lumpsum">Lumpsum (One-Time)</SelectItem>
                          <SelectItem value="Recurring">Recurring (Installments)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Start Date *</Label>
                      <Popover>
                        <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                          <CalendarDays className="size-4 mr-2" />
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

                  <div className="grid gap-4 sm:grid-cols-2">
                    {investmentMode === "Recurring" && (
                      <div className="grid gap-2">
                        <Label>Installment Frequency</Label>
                        <Select value={installmentFrequency} onValueChange={(val) => setInstallmentFrequency(val as any)}>
                          <SelectTrigger className="w-full">
                            <SelectValue>{installmentFrequency}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Monthly">Monthly</SelectItem>
                            <SelectItem value="Quarterly">Quarterly</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="grid gap-2">
                      <Label htmlFor="interest-rate">Interest Rate (% p.a.) *</Label>
                      <Input
                        id="interest-rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        placeholder="e.g. 7.1"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Compounding Frequency</Label>
                      <Select value={compoundingFrequency} onValueChange={(val) => setCompoundingFrequency(val as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{compoundingFrequency}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly Compounding</SelectItem>
                          <SelectItem value="Quarterly">Quarterly Compounding</SelectItem>
                          <SelectItem value="Half-Yearly">Half-Yearly Compounding</SelectItem>
                          <SelectItem value="Annually">Annual Compounding</SelectItem>
                          <SelectItem value="At Maturity">Simple Interest (At Maturity)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Tenure Unit *</Label>
                      <Select value={tenureUnit} onValueChange={(val) => setTenureUnit(val as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{tenureUnit}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Months">Months</SelectItem>
                          <SelectItem value="Years">Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="tenure-val">Tenure Value *</Label>
                      <Input
                        id="tenure-val"
                        type="number"
                        min="1"
                        step="1"
                        value={tenureValue}
                        onChange={(e) => setTenureValue(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="fixed-current-value">Current Value <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Input
                        id="fixed-current-value"
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentValue}
                        onChange={(e) => setCurrentValue(e.target.value)}
                        placeholder={investmentMode === "Lumpsum" ? "Defaults to principal" : "Defaults to 0"}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 border-t pt-3 mt-1">
                    <div className="grid gap-2">
                      <Label htmlFor="expected-override">Maturity Amt Override <span className="font-normal text-muted-foreground">(opt)</span></Label>
                      <Input
                        id="expected-override"
                        type="number"
                        min="0"
                        step="0.01"
                        value={expectedMaturityAmount}
                        onChange={(e) => setExpectedMaturityAmount(e.target.value)}
                        placeholder="Defaults to auto-calc"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Maturity Date Override <span className="font-normal text-muted-foreground">(opt)</span></Label>
                      <Popover>
                        <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal text-xs" />}>
                          <CalendarDays className="size-4 mr-2" />
                          {maturityDate ? format(new Date(`${maturityDate}T12:00:00`), "dd MMM yyyy") : "Defaults to auto-calc"}
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={maturityDate ? new Date(`${maturityDate}T12:00:00`) : undefined}
                            onSelect={(d) => setMaturityDate(d ? format(d, "yyyy-MM-dd") : "")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  {investmentMode === "Lumpsum" && (
                    <div className="grid gap-2">
                      <Label>Source Bank Account (Debit Principal)</Label>
                      <Select value={bankAccount} onValueChange={(val) => setBankAccount(val ?? "")}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose an account (optional)">
                            {bankAccount && bankAccount !== "none"
                              ? getBankAccountLabel(bankAccounts.find((a) => a.id === bankAccount)) +
                                (bankAccounts.find((a) => a.id === bankAccount)?.last4Digits
                                  ? ` · ${bankAccounts.find((a) => a.id === bankAccount)?.last4Digits}`
                                  : "")
                              : "Choose an account (optional)"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Choose an account (optional)</SelectItem>
                          {bankAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {getBankAccountLabel(acc)} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Math Live calculation preview */}
                  {previewMaturityDateStr && (
                    <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-primary text-xs flex flex-col gap-1 sm:col-span-2">
                      <div className="font-semibold flex items-center gap-1.5 text-foreground">
                        <CircleDollarSign className="size-4 text-primary" />
                        Projected Maturity Details (Estimates)
                      </div>
                      <div className="flex justify-between mt-1 text-muted-foreground">
                        <span>Maturity Date:</span>
                        <span className="font-semibold text-foreground">{previewMaturityDateStr}</span>
                      </div>
                      {previewExpectedMaturityVal > 0 && (
                        <div className="flex justify-between text-muted-foreground">
                          <span>Projected Payout:</span>
                          <span className="font-bold text-foreground">
                            ₹{Math.round(previewExpectedMaturityVal).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
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
                      <CalendarDays className="size-4 mr-2" />
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
                      <CalendarDays className="size-4 mr-2" />
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
                        ? getBankAccountLabel(bankAccounts.find((a) => a.id === bankAccount)) +
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
                        {getBankAccountLabel(acc)} {acc.last4Digits ? `· ${acc.last4Digits}` : ""}
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
