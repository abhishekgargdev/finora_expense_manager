"use client";

import * as React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Cell, Pie, PieChart } from "recharts";
import {
  CalendarDays,
  ChartNoAxesCombined,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/finance/EmptyState";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
import StatusBadge from "@/components/finance/StatusBadge";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import PageSkeleton from "@/components/loader/PageSkeleton";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { staggerContainer } from "@/lib/motion";
import {
  type InvestmentEntry,
  type ContributionEntry,
  type InvestmentInput,
  useInvestments,
} from "@/hooks/useInvestments";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import {
  calculateMaturityDate,
  calculateLumpsumMaturity,
  calculateRecurringMaturity,
  daysToMaturity,
  tenureProgressPercent,
} from "@/lib/investment-calculations";

const MARKET_TYPES = ["Mutual Fund", "Stocks", "Gold", "Crypto", "Other"];
const FIXED_TYPES = ["FD", "RD", "PPF", "NPS", "Bonds", "Bank RD Plan", "Other"];
const ALL_TYPES = [...MARKET_TYPES, ...FIXED_TYPES.filter((t) => !MARKET_TYPES.includes(t))];

const COLORS = [
  "var(--investment)",
  "var(--primary)",
  "var(--secondary)",
  "var(--income)",
  "#ca8a04",
  "#db2777",
  "#0891b2",
  "#64748b",
  "#10b981",
  "#f59e0b",
  "#6366f1",
];

const chartConfig = Object.fromEntries(
  ALL_TYPES.map((type, index) => [type, { label: type, color: COLORS[index % COLORS.length] }])
) satisfies ChartConfig;

type FormState = {
  category: "Market-Linked" | "Fixed-Tenure";
  type: string;
  name: string;
  amountInvested: string;
  currentValue: string;
  date: string;
  note: string;

  // Fixed-Tenure details
  investmentMode: "Lumpsum" | "Recurring";
  institution: string;
  planName: string;
  accountOrPolicyNumber: string;
  bankAccount: string;
  principalAmount: string;
  installmentAmount: string;
  installmentFrequency: "Monthly" | "Quarterly";
  interestRate: string;
  compoundingFrequency: "Monthly" | "Quarterly" | "Half-Yearly" | "Annually" | "At Maturity";
  startDate: string;
  tenureValue: string;
  tenureUnit: "Months" | "Years";
  expectedMaturityAmount: string;
  maturityDate: string;
  status: "Active" | "Matured" | "Closed Prematurely";
  actualMaturityAmount: string;
  actualClosureDate: string;
};

const emptyForm = (): FormState => ({
  category: "Market-Linked",
  type: "Mutual Fund",
  name: "",
  amountInvested: "",
  currentValue: "",
  date: format(new Date(), "yyyy-MM-dd"),
  note: "",

  investmentMode: "Lumpsum",
  institution: "",
  planName: "",
  accountOrPolicyNumber: "",
  bankAccount: "",
  principalAmount: "",
  installmentAmount: "",
  installmentFrequency: "Monthly",
  interestRate: "",
  compoundingFrequency: "Quarterly",
  startDate: format(new Date(), "yyyy-MM-dd"),
  tenureValue: "",
  tenureUnit: "Months",
  expectedMaturityAmount: "",
  maturityDate: "",
  status: "Active",
  actualMaturityAmount: "",
  actualClosureDate: format(new Date(), "yyyy-MM-dd"),
});

const toForm = (item: InvestmentEntry): FormState => ({
  category: item.category ?? "Market-Linked",
  type: item.type,
  name: item.name ?? "",
  amountInvested: String(item.amountInvested),
  currentValue: String(item.currentValue),
  date: format(new Date(item.date), "yyyy-MM-dd"),
  note: item.note ?? "",

  investmentMode: item.investmentMode ?? "Lumpsum",
  institution: item.institution ?? "",
  planName: item.planName ?? "",
  accountOrPolicyNumber: item.accountOrPolicyNumber ?? "",
  bankAccount: item.bankAccount ?? "",
  principalAmount: item.principalAmount !== undefined ? String(item.principalAmount) : "",
  installmentAmount: item.installmentAmount !== undefined ? String(item.installmentAmount) : "",
  installmentFrequency: item.installmentFrequency ?? "Monthly",
  interestRate: item.interestRate !== undefined ? String(item.interestRate) : "",
  compoundingFrequency: item.compoundingFrequency ?? "Quarterly",
  startDate: item.startDate ? format(new Date(item.startDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
  tenureValue: item.tenureValue !== undefined ? String(item.tenureValue) : "",
  tenureUnit: item.tenureUnit ?? "Months",
  expectedMaturityAmount: item.expectedMaturityAmount !== undefined ? String(item.expectedMaturityAmount) : "",
  maturityDate: item.maturityDate ? format(new Date(item.maturityDate), "yyyy-MM-dd") : "",
  status: item.status ?? "Active",
  actualMaturityAmount: item.actualMaturityAmount !== undefined ? String(item.actualMaturityAmount) : "",
  actualClosureDate: item.actualClosureDate ? format(new Date(item.actualClosureDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
});

export default function InvestmentsPage() {
  const { investments, isLoading, isMutating, create, update, remove, fetchContributions, updateContribution } =
    useInvestments();
  const { accounts: bankAccounts } = useBankAccounts();

  const [activeTab, setActiveTab] = React.useState<string>("All");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InvestmentEntry | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  // Contributions Checklist state
  const [contributionsMap, setContributionsMap] = React.useState<Record<string, ContributionEntry[]>>({});
  const [loadingContributions, setLoadingContributions] = React.useState<Record<string, boolean>>({});
  const [expandedInvestments, setExpandedInvestments] = React.useState<Record<string, boolean>>({});

  // Mark Paid dialog state
  const [markPaidOpen, setMarkPaidOpen] = React.useState(false);
  const [selectedContribution, setSelectedContribution] = React.useState<ContributionEntry | null>(null);
  const [selectedContributionParent, setSelectedContributionParent] = React.useState<InvestmentEntry | null>(null);
  const [markPaidForm, setMarkPaidForm] = React.useState({
    bankAccount: "",
    paidDate: format(new Date(), "yyyy-MM-dd"),
    amount: "",
    note: "",
  });

  // Upcoming maturities state
  const [upcomingMaturities, setUpcomingMaturities] = React.useState<InvestmentEntry[]>([]);

  const loadUpcoming = React.useCallback(async () => {
    try {
      const res = await fetch("/api/investments/upcoming-maturities?withinDays=60");
      if (res.ok) {
        const data = await res.json();
        setUpcomingMaturities(data.investments || []);
      }
    } catch (error) {
      console.error("Failed to load upcoming maturities", error);
    }
  }, []);

  React.useEffect(() => {
    void loadUpcoming();
  }, [loadUpcoming, investments]);

  // Aggregate Calculations
  const marketLinked = investments.filter((item) => (item.category ?? "Market-Linked") === "Market-Linked");
  const fixedTenure = investments.filter((item) => item.category === "Fixed-Tenure");

  const totalInvested = marketLinked.reduce((sum, item) => sum + item.amountInvested, 0);
  const totalCurrent = marketLinked.reduce((sum, item) => sum + item.currentValue, 0);
  const gain = totalCurrent - totalInvested;
  const gainPercent = totalInvested ? (gain / totalInvested) * 100 : 0;

  const fixedTotalInvested = fixedTenure.reduce((sum, item) => sum + item.amountInvested, 0);
  const fixedTotalProjected = fixedTenure.reduce((sum, item) => {
    if (item.status === "Active") {
      return sum + (item.expectedMaturityAmount ?? 0);
    } else {
      return sum + (item.actualMaturityAmount ?? item.expectedMaturityAmount ?? 0);
    }
  }, 0);

  const chartData = ALL_TYPES.map((type, index) => ({
    type,
    value: investments.filter((item) => item.type === type).reduce((sum, item) => sum + item.currentValue, 0),
    fill: COLORS[index % COLORS.length],
  })).filter((item) => item.value > 0);

  const change = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(item: InvestmentEntry) {
    setEditing(item);
    setForm(toForm(item));
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: InvestmentInput = {
      category: form.category,
      type: form.type,
      name: form.name.trim() || undefined,
      note: form.note.trim() || undefined,
    };

    if (form.category === "Market-Linked") {
      const amountInvested = Number(form.amountInvested);
      const currentValue = Number(form.currentValue || form.amountInvested);
      if (!Number.isFinite(amountInvested) || amountInvested <= 0 || !Number.isFinite(currentValue) || currentValue < 0)
        return toast.error("Enter valid investment amounts.");
      payload.amountInvested = amountInvested;
      payload.currentValue = currentValue;
      payload.date = new Date(`${form.date}T12:00:00`).toISOString();
    } else {
      const rate = Number(form.interestRate);
      const tenureValue = Number(form.tenureValue);
      if (!Number.isFinite(rate) || rate < 0) return toast.error("Enter a valid interest rate.");
      if (!Number.isFinite(tenureValue) || tenureValue <= 0) return toast.error("Enter a valid tenure.");

      payload.institution = form.institution.trim();
      if (!payload.institution) return toast.error("Institution is required.");

      payload.planName = form.planName.trim() || undefined;
      payload.accountOrPolicyNumber = form.accountOrPolicyNumber.trim() || undefined;
      payload.investmentMode = form.investmentMode;
      payload.interestRate = rate;
      payload.compoundingFrequency = form.compoundingFrequency;
      payload.startDate = new Date(`${form.startDate}T12:00:00`).toISOString();
      payload.tenureValue = tenureValue;
      payload.tenureUnit = form.tenureUnit;
      payload.bankAccount = form.bankAccount || undefined;

      if (form.investmentMode === "Lumpsum") {
        const principal = Number(form.principalAmount);
        if (!Number.isFinite(principal) || principal <= 0) return toast.error("Enter a valid principal amount.");
        payload.principalAmount = principal;
        payload.amountInvested = principal;
      } else {
        const installment = Number(form.installmentAmount);
        if (!Number.isFinite(installment) || installment <= 0) return toast.error("Enter a valid installment amount.");
        payload.installmentAmount = installment;
        payload.installmentFrequency = form.installmentFrequency;
      }

      if (form.maturityDate) {
        payload.maturityDate = new Date(`${form.maturityDate}T12:00:00`).toISOString();
      }
      if (form.expectedMaturityAmount) {
        payload.expectedMaturityAmount = Number(form.expectedMaturityAmount);
      }

      if (editing) {
        payload.status = form.status;
        if (form.status === "Matured" || form.status === "Closed Prematurely") {
          const actualVal = Number(form.actualMaturityAmount);
          if (!Number.isFinite(actualVal) || actualVal < 0) return toast.error("Enter a valid actual maturity amount.");
          payload.actualMaturityAmount = actualVal;
          payload.actualClosureDate = new Date(`${form.actualClosureDate}T12:00:00`).toISOString();
        }
      }
    }

    try {
      if (editing) {
        await update(editing.id, payload);
        toast.success("Investment updated.");
      } else {
        await create(payload);
        toast.success("Investment added.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save investment.");
    }
  }

  const [itemToDelete, setItemToDelete] = React.useState<InvestmentEntry | null>(null);
  async function deleteItem() {
    if (!itemToDelete) return;
    try {
      await remove(itemToDelete.id);
      toast.success("Investment deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete investment.");
    }
  }

  // Lazy loading of contributions
  async function toggleExpand(investmentId: string) {
    const isExpanded = !expandedInvestments[investmentId];
    setExpandedInvestments((current) => ({ ...current, [investmentId]: isExpanded }));

    if (isExpanded && !contributionsMap[investmentId]) {
      setLoadingContributions((current) => ({ ...current, [investmentId]: true }));
      try {
        const data = await fetchContributions(investmentId);
        setContributionsMap((current) => ({ ...current, [investmentId]: data.contributions }));
      } catch (error) {
        toast.error("Failed to load installments checklist.");
      } finally {
        setLoadingContributions((current) => ({ ...current, [investmentId]: false }));
      }
    }
  }

  function openMarkPaid(c: ContributionEntry, parent: InvestmentEntry) {
    setSelectedContribution(c);
    setSelectedContributionParent(parent);
    setMarkPaidForm({
      bankAccount: parent.bankAccount || "",
      paidDate: format(new Date(), "yyyy-MM-dd"),
      amount: String(c.amount),
      note: "",
    });
    setMarkPaidOpen(true);
  }

  async function submitMarkPaid(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedContribution) return;
    const amt = Number(markPaidForm.amount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error("Enter valid paid amount.");

    try {
      const res = await updateContribution(selectedContribution.id, {
        status: "Paid",
        paidDate: new Date(`${markPaidForm.paidDate}T12:00:00`).toISOString(),
        bankAccount: markPaidForm.bankAccount || undefined,
        amount: amt,
        note: markPaidForm.note.trim() || undefined,
      });

      if (contributionsMap[selectedContribution.investment]) {
        setContributionsMap((current) => ({
          ...current,
          [selectedContribution.investment]: current[selectedContribution.investment].map((c) =>
            c.id === selectedContribution.id ? res.contribution : c
          ),
        }));
      }

      toast.success("Installment marked as Paid.");
      setMarkPaidOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to record payment.");
    }
  }

  const [contributionToRevert, setContributionToRevert] = React.useState<ContributionEntry | null>(null);
  async function handleRevertPayment() {
    if (!contributionToRevert) return;
    try {
      const res = await updateContribution(contributionToRevert.id, {
        status: "Pending",
        paidDate: null,
        bankAccount: null,
      });

      if (contributionsMap[contributionToRevert.investment]) {
        setContributionsMap((current) => ({
          ...current,
          [contributionToRevert.investment]: current[contributionToRevert.investment].map((item) => (item.id === contributionToRevert.id ? res.contribution : item)),
        }));
      }

      toast.success("Installment status reset to Pending.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to revert payment.");
    }
  }

  // Live preview logic for the modal
  let previewMaturityDateStr = "";
  let previewExpectedMaturityVal = 0;

  if (form.category === "Fixed-Tenure") {
    const start = new Date(form.startDate);
    const tenureVal = Number(form.tenureValue);
    const tenureUnit = form.tenureUnit;
    const rate = Number(form.interestRate);

    if (!Number.isNaN(start.getTime()) && Number.isFinite(tenureVal) && tenureVal > 0) {
      const matDate = calculateMaturityDate(start, tenureVal, tenureUnit);
      previewMaturityDateStr = format(matDate, "dd MMM yyyy");

      if (Number.isFinite(rate) && rate >= 0) {
        if (form.investmentMode === "Lumpsum") {
          const principal = Number(form.principalAmount);
          if (Number.isFinite(principal) && principal > 0) {
            previewExpectedMaturityVal = calculateLumpsumMaturity(
              principal,
              rate,
              start,
              matDate,
              form.compoundingFrequency
            );
          }
        } else {
          const installment = Number(form.installmentAmount);
          if (Number.isFinite(installment) && installment > 0) {
            const tenureInMonths = tenureUnit === "Years" ? tenureVal * 12 : tenureVal;
            const totalInstallments =
              form.installmentFrequency === "Quarterly" ? Math.round(tenureInMonths / 3) : tenureInMonths;

            previewExpectedMaturityVal = calculateRecurringMaturity(
              installment,
              rate,
              form.installmentFrequency,
              totalInstallments
            );
          }
        }
      }
    }
  }

  if (isLoading) return <PageSkeleton variant="chart" />;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Investments</h2>
          <p className="mt-1 text-sm text-muted-foreground">Monitor contributions, present value, and performance.</p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus />
          Add Investment
        </Button>
      </div>

      {/* Maturing Soon Banner Widget */}
      {upcomingMaturities.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-amber-800 dark:text-amber-300 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-sm sm:text-base">
            <AlertTriangle className="size-5 text-amber-500 shrink-0" />
            <span>Investments Maturing Soon (Within 60 Days)</span>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 mt-1">
            {upcomingMaturities.map((item) => {
              const days = daysToMaturity(item.maturityDate!);
              const countdownText = days === 0 ? "Matures today" : days < 0 ? `Overdue by ${Math.abs(days)} days` : `Matures in ${days} days`;
              return (
                <div
                  key={item.id}
                  className="bg-background/85 dark:bg-muted/40 rounded-lg p-3 border border-amber-500/10 shadow-sm flex flex-col justify-between gap-1 text-xs"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase font-medium">{item.institution}</p>
                      <h4 className="font-semibold text-foreground truncate max-w-44">{item.name || item.type}</h4>
                    </div>
                    <StatusBadge status={item.status!} />
                  </div>
                  <div className="mt-2 flex items-center justify-between font-medium">
                    <span className={days <= 7 ? "text-destructive font-semibold" : "text-muted-foreground"}>
                      {countdownText}
                    </span>
                    <span className="font-bold text-foreground">
                      <MoneyText value={item.expectedMaturityAmount || 0} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <motion.div
        className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<WalletCards />} label="Market Invested" value={totalInvested} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<ChartNoAxesCombined />} label="Market Value" value={totalCurrent} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <div className="card p-4 h-full">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-investment-10 text-investment shrink-0">
                <ChartNoAxesCombined />
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground truncate">Market Gain/Loss</p>
                <MoneyText
                  value={gain}
                  variant={gain >= 0 ? "positive" : "negative"}
                  className="mt-1 text-2xl font-semibold block truncate"
                />
                <p className={gain >= 0 ? "mt-1 text-sm text-settled truncate" : "mt-1 text-sm text-expense truncate"}>
                  {gain >= 0 ? "+" : ""}
                  {gainPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<WalletCards className="text-amber-500" />} label="Fixed Invested" value={fixedTotalInvested} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<ChartNoAxesCombined className="text-emerald-500" />} label="Projected Payout" value={fixedTotalProjected} />
        </motion.div>
      </motion.div>

      {/* Tabs Filter Section */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-1 gap-3">
          <TabsList className="bg-muted p-[3px] rounded-lg">
            <TabsTrigger value="All" className="px-3 py-1.5 text-xs sm:text-sm">All Holdings</TabsTrigger>
            <TabsTrigger value="Market-Linked" className="px-3 py-1.5 text-xs sm:text-sm">Market-Linked</TabsTrigger>
            <TabsTrigger value="Fixed-Tenure" className="px-3 py-1.5 text-xs sm:text-sm">Fixed-Tenure</TabsTrigger>
          </TabsList>
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline-block">
            Showing {activeTab === "All" ? investments.length : activeTab === "Market-Linked" ? marketLinked.length : fixedTenure.length} entries
          </span>
        </div>

        {/* --- ALL HOLDINGS TAB --- */}
        <TabsContent value="All" className="mt-6 space-y-8">
          {investments.length === 0 ? (
            <EmptyState
              icon={<ChartNoAxesCombined />}
              title="No investments yet"
              description="Add your first holding to track allocation and performance."
              action={
                <Button onClick={openCreate}>
                  <Plus />
                  Add your first investment
                </Button>
              }
            />
          ) : (
            <div className="space-y-8">
              {marketLinked.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-lg font-semibold font-heading">Market-Linked Assets</h3>
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="card overflow-hidden">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Type</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Date</TableHead>
                              <TableHead className="text-right">Invested</TableHead>
                              <TableHead className="text-right">Current Value</TableHead>
                              <TableHead className="text-right">Gain / Loss</TableHead>
                              <TableHead className="w-20" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {marketLinked.map((item) => {
                              const difference = item.currentValue - item.amountInvested;
                              return (
                                <TableRow key={item.id}>
                                  <TableCell className="font-semibold text-xs sm:text-sm">{item.type}</TableCell>
                                  <TableCell>
                                    <div className="font-medium text-xs sm:text-sm">{item.name || "Untitled"}</div>
                                    {item.note && <div className="max-w-40 truncate text-xs text-muted-foreground">{item.note}</div>}
                                  </TableCell>
                                  <TableCell className="text-xs sm:text-sm">{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                                  <TableCell className="text-right text-xs sm:text-sm">
                                    <MoneyText value={item.amountInvested} />
                                  </TableCell>
                                  <TableCell className="text-right text-xs sm:text-sm">
                                    <MoneyText value={item.currentValue} />
                                  </TableCell>
                                  <TableCell className="text-right text-xs sm:text-sm">
                                    <MoneyText value={difference} variant={difference >= 0 ? "positive" : "negative"} />
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              onClick={() => openEdit(item)}
                                              aria-label="Edit"
                                            />
                                          }
                                        >
                                          <Pencil />
                                        </TooltipTrigger>
                                        <TooltipContent>Edit</TooltipContent>
                                      </Tooltip>
                                      <Tooltip>
                                        <TooltipTrigger
                                          render={
                                            <Button
                                              variant="ghost"
                                              size="icon-sm"
                                              className="text-destructive hover:text-destructive"
                                              onClick={() => setItemToDelete(item)}
                                              aria-label="Delete"
                                            />
                                          }
                                        >
                                          <Trash2 />
                                        </TooltipTrigger>
                                        <TooltipContent>Delete</TooltipContent>
                                      </Tooltip>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                    <section className="card p-4 h-fit">
                      <h3 className="font-heading text-sm font-semibold">Asset Allocation</h3>
                      <ChartContainer config={chartConfig} className="mx-auto mt-2 aspect-square max-h-72">
                        <PieChart>
                          <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="type" />} />
                          <Pie
                            data={chartData}
                            dataKey="value"
                            nameKey="type"
                            innerRadius="58%"
                            outerRadius="82%"
                            paddingAngle={3}
                          >
                            {chartData.map((item) => (
                              <Cell key={item.type} fill={item.fill} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ChartContainer>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {chartData.map((item) => (
                          <div key={item.type} className="flex items-center gap-2 truncate">
                            <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.fill }} />
                            <span className="truncate text-muted-foreground">{item.type}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  </div>
                </div>
              )}

              {fixedTenure.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold font-heading">Fixed-Tenure Investments</h3>
                  <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {fixedTenure.map((item) => (
                      <FixedTenureCard
                        key={item.id}
                        item={item}
                        onEdit={openEdit}
                        onDelete={setItemToDelete}
                        onExpand={toggleExpand}
                        isExpanded={!!expandedInvestments[item.id]}
                        contributions={contributionsMap[item.id] || []}
                        isLoadingContribs={!!loadingContributions[item.id]}
                        onMarkPaid={openMarkPaid}
                        onRevertPaid={setContributionToRevert}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* --- MARKET LINKED TAB --- */}
        <TabsContent value="Market-Linked" className="mt-6">
          {marketLinked.length === 0 ? (
            <EmptyState
              icon={<ChartNoAxesCombined />}
              title="No market-linked investments"
              description="Add mutual funds, stocks, gold, or crypto assets to track."
              action={
                <Button onClick={openCreate}>
                  <Plus />
                  Add Investment
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Invested</TableHead>
                        <TableHead className="text-right">Current Value</TableHead>
                        <TableHead className="text-right">Gain / Loss</TableHead>
                        <TableHead className="w-20" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {marketLinked.map((item) => {
                        const difference = item.currentValue - item.amountInvested;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-semibold text-xs sm:text-sm">{item.type}</TableCell>
                            <TableCell>
                              <div className="font-medium text-xs sm:text-sm">{item.name || "Untitled"}</div>
                              {item.note && <div className="max-w-40 truncate text-xs text-muted-foreground">{item.note}</div>}
                            </TableCell>
                            <TableCell className="text-xs sm:text-sm">{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              <MoneyText value={item.amountInvested} />
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              <MoneyText value={item.currentValue} />
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              <MoneyText value={difference} variant={difference >= 0 ? "positive" : "negative"} />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => openEdit(item)}
                                        aria-label="Edit"
                                      />
                                    }
                                  >
                                    <Pencil />
                                  </TooltipTrigger>
                                  <TooltipContent>Edit</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => setItemToDelete(item)}
                                        aria-label="Delete"
                                      />
                                    }
                                  >
                                    <Trash2 />
                                  </TooltipTrigger>
                                  <TooltipContent>Delete</TooltipContent>
                                </Tooltip>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
              <section className="card p-4 h-fit">
                <h3 className="font-heading text-sm font-semibold">Asset Allocation</h3>
                <ChartContainer config={chartConfig} className="mx-auto mt-2 aspect-square max-h-72">
                  <PieChart>
                    <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="type" />} />
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="type"
                      innerRadius="58%"
                      outerRadius="82%"
                      paddingAngle={3}
                    >
                      {chartData.map((item) => (
                        <Cell key={item.type} fill={item.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {chartData.map((item) => (
                    <div key={item.type} className="flex items-center gap-2 truncate">
                      <span className="size-2 shrink-0 rounded-sm" style={{ backgroundColor: item.fill }} />
                      <span className="truncate text-muted-foreground">{item.type}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </TabsContent>

        {/* --- FIXED TENURE TAB --- */}
        <TabsContent value="Fixed-Tenure" className="mt-6">
          {fixedTenure.length === 0 ? (
            <EmptyState
              icon={<WalletCards />}
              title="No fixed-tenure holdings"
              description="Add Fixed Deposits (FD), Recurring Deposits (RD), or PPF structures."
              action={
                <Button onClick={openCreate}>
                  <Plus />
                  Add Investment
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {fixedTenure.map((item) => (
                <FixedTenureCard
                  key={item.id}
                  item={item}
                  onEdit={openEdit}
                  onDelete={setItemToDelete}
                  onExpand={toggleExpand}
                  isExpanded={!!expandedInvestments[item.id]}
                  contributions={contributionsMap[item.id] || []}
                  isLoadingContribs={!!loadingContributions[item.id]}
                  onMarkPaid={openMarkPaid}
                  onRevertPaid={setContributionToRevert}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- ADD/EDIT INVESTMENT DIALOG --- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto w-[92%] max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit investment" : "Add investment"}</DialogTitle>
            <DialogDescription>Record a holding and configuration parameters.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            {/* Category Select */}
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(val) => {
                  setForm((current) => ({
                    ...current,
                    category: val as any,
                    type: val === "Market-Linked" ? "Mutual Fund" : "FD",
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>{form.category}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Market-Linked">Market-Linked (Stocks, MFs, Gold, Crypto)</SelectItem>
                  <SelectItem value="Fixed-Tenure">Fixed-Tenure (FD, RD, PPF, NPS, Bonds)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Render conditional forms based on category selection */}
            {form.category === "Market-Linked" ? (
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(value) => change("type", value ?? "Other")}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{form.type}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MARKET_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="investment-name">Name</Label>
                    <Input
                      id="investment-name"
                      value={form.name}
                      onChange={(event) => change("name", event.target.value)}
                      placeholder="Asset name (e.g. BTC, HDFC Stock)"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="amount-invested">Amount Invested</Label>
                    <Input
                      id="amount-invested"
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.amountInvested}
                      onChange={(event) => change("amountInvested", event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="current-value">Current Value</Label>
                    <Input
                      id="current-value"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.currentValue}
                      onChange={(event) => change("currentValue", event.target.value)}
                      placeholder="Defaults to invested amount"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>Purchase Date</Label>
                  <Popover>
                    <PopoverTrigger
                      render={<Button variant="outline" className="w-full justify-start font-normal" />}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {format(new Date(`${form.date}T12:00:00`), "dd MMM yyyy")}
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(`${form.date}T12:00:00`)}
                        onSelect={(date) => date && change("date", format(date, "yyyy-MM-dd"))}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            ) : (
              // FIXED TENURE FORMS
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={form.type} onValueChange={(value) => change("type", value ?? "Other")}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{form.type}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {FIXED_TYPES.map((type) => (
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
                      value={form.institution}
                      onChange={(event) => change("institution", event.target.value)}
                      placeholder="e.g. ICICI Bank, Govt of India"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="plan-name">Plan Name</Label>
                    <Input
                      id="plan-name"
                      value={form.planName}
                      onChange={(event) => change("planName", event.target.value)}
                      placeholder="e.g. iWish RD, Regular FD"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="policy-number">Reference / Account / Policy #</Label>
                    <Input
                      id="policy-number"
                      value={form.accountOrPolicyNumber}
                      onChange={(event) => change("accountOrPolicyNumber", event.target.value)}
                      placeholder="e.g. FD1234567"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Investment Mode</Label>
                    <Select
                      value={form.investmentMode}
                      onValueChange={(val) => change("investmentMode", val as any)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{form.investmentMode}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lumpsum">Lumpsum (One-Time)</SelectItem>
                        <SelectItem value="Recurring">Recurring (Installments)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.investmentMode === "Lumpsum" ? (
                    <div className="grid gap-2">
                      <Label htmlFor="principal-amount">Principal Amount *</Label>
                      <Input
                        id="principal-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.principalAmount}
                        onChange={(event) => change("principalAmount", event.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      <Label htmlFor="installment-amount">Installment Amount *</Label>
                      <Input
                        id="installment-amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.installmentAmount}
                        onChange={(event) => change("installmentAmount", event.target.value)}
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {form.investmentMode === "Recurring" && (
                    <div className="grid gap-2">
                      <Label>Installment Frequency</Label>
                      <Select
                        value={form.installmentFrequency}
                        onValueChange={(val) => change("installmentFrequency", val as any)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue>{form.installmentFrequency}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Monthly">Monthly</SelectItem>
                          <SelectItem value="Quarterly">Quarterly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="grid gap-2">
                    <Label htmlFor="interest-rate">Nominal Interest Rate (% p.a.) *</Label>
                    <Input
                      id="interest-rate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={form.interestRate}
                      onChange={(event) => change("interestRate", event.target.value)}
                      placeholder="e.g. 7.25"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Compounding Frequency</Label>
                    <Select
                      value={form.compoundingFrequency}
                      onValueChange={(val) => change("compoundingFrequency", val as any)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue>{form.compoundingFrequency}</SelectValue>
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
                    <Label>Start Date *</Label>
                    <Popover>
                      <PopoverTrigger
                        render={<Button variant="outline" className="w-full justify-start font-normal" />}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {format(new Date(`${form.startDate}T12:00:00`), "dd MMM yyyy")}
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={new Date(`${form.startDate}T12:00:00`)}
                          onSelect={(date) => date && change("startDate", format(date, "yyyy-MM-dd"))}
                        />
                      </PopoverContent>
                    </Popover>
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
                      value={form.tenureValue}
                      onChange={(event) => change("tenureValue", event.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Tenure Unit *</Label>
                    <Select value={form.tenureUnit} onValueChange={(val) => change("tenureUnit", val as any)}>
                      <SelectTrigger className="w-full">
                        <SelectValue>{form.tenureUnit}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Months">Months</SelectItem>
                        <SelectItem value="Years">Years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Overrides and custom overrides */}
                <div className="grid gap-4 sm:grid-cols-2 border-t pt-3 mt-1">
                  <div className="grid gap-2">
                    <Label htmlFor="expected-override">
                      Maturity Amount Override <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="expected-override"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.expectedMaturityAmount}
                      onChange={(event) => change("expectedMaturityAmount", event.target.value)}
                      placeholder="Defaults to auto-calc"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>
                      Maturity Date Override <span className="font-normal text-muted-foreground">(optional)</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger
                        render={<Button variant="outline" className="w-full justify-start font-normal text-xs" />}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {form.maturityDate
                          ? format(new Date(`${form.maturityDate}T12:00:00`), "dd MMM yyyy")
                          : "Defaults to auto-calc"}
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={form.maturityDate ? new Date(`${form.maturityDate}T12:00:00`) : undefined}
                          onSelect={(date) => change("maturityDate", date ? format(date, "yyyy-MM-dd") : "")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Account details and logs */}
                {form.investmentMode === "Lumpsum" && (
                  <div className="grid gap-2">
                    <Label>Source Bank Account (Debit Principal)</Label>
                    <Select value={form.bankAccount} onValueChange={(val) => change("bankAccount", val ?? "")}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select account (Optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName} {account.last4Digits ? `(***${account.last4Digits})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                  </div>
                )}

                {/* Edit-only Status controls */}
                {editing && (
                  <div className="border-t pt-3 grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Status</Label>
                      <Select value={form.status} onValueChange={(val) => change("status", val as any)}>
                        <SelectTrigger className="w-full">
                          <SelectValue>{form.status}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Matured">Matured</SelectItem>
                          <SelectItem value="Closed Prematurely">Closed Prematurely</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(form.status === "Matured" || form.status === "Closed Prematurely") && (
                      <div className="grid gap-2 sm:col-span-2 grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="actual-payout">Actual Payout *</Label>
                          <Input
                            id="actual-payout"
                            type="number"
                            min="0"
                            step="0.01"
                            value={form.actualMaturityAmount}
                            onChange={(event) => change("actualMaturityAmount", event.target.value)}
                            required
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label>Closure Date *</Label>
                          <Popover>
                            <PopoverTrigger
                              render={<Button variant="outline" className="w-full justify-start font-normal text-xs" />}
                            >
                              <CalendarDays className="mr-2 h-4 w-4" />
                              {format(new Date(`${form.actualClosureDate}T12:00:00`), "dd MMM yyyy")}
                            </PopoverTrigger>
                            <PopoverContent align="start" className="w-auto p-0">
                              <Calendar
                                mode="single"
                                selected={new Date(`${form.actualClosureDate}T12:00:00`)}
                                onSelect={(date) => date && change("actualClosureDate", format(date, "yyyy-MM-dd"))}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Math Live calculation preview */}
                {previewMaturityDateStr && (
                  <div className="rounded-lg bg-primary/10 border border-primary/20 p-3 text-primary text-xs flex flex-col gap-1 sm:col-span-2">
                    <div className="font-semibold flex items-center gap-1.5 text-foreground">
                      <ChartNoAxesCombined className="size-4 text-primary" />
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
              </div>
            )}

            {/* Note field */}
            <div className="grid gap-2">
              <Label htmlFor="investment-note">Note (Optional)</Label>
              <Input
                id="investment-note"
                value={form.note}
                onChange={(event) => change("note", event.target.value)}
                placeholder="Reference details, contact information"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">{editing ? "Save changes" : "Add investment"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* --- MARK PAID DIALOG --- */}
      <Dialog open={markPaidOpen} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto w-[92%] max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Mark Installment Paid</DialogTitle>
            <DialogDescription>Record payment debit and log expense entry.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitMarkPaid}>
            <div className="grid gap-2">
              <Label htmlFor="mark-amount">Installment Amount</Label>
              <Input
                id="mark-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={markPaidForm.amount}
                onChange={(e) => setMarkPaidForm((curr) => ({ ...curr, amount: e.target.value }))}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Source Bank Account (Debit Installment)</Label>
              <Select
                value={markPaidForm.bankAccount}
                onValueChange={(val) => setMarkPaidForm((curr) => ({ ...curr, bankAccount: val ?? "" }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select account (Optional)" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.accountName ? `${account.bankName} (${account.accountName})` : account.bankName} {account.last4Digits ? `(***${account.last4Digits})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Date Paid</Label>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" className="w-full justify-start font-normal" />}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {format(new Date(`${markPaidForm.paidDate}T12:00:00`), "dd MMM yyyy")}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={new Date(`${markPaidForm.paidDate}T12:00:00`)}
                    onSelect={(date) =>
                      date && setMarkPaidForm((curr) => ({ ...curr, paidDate: format(date, "yyyy-MM-dd") }))
                    }
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="mark-note">Note (Optional)</Label>
              <Input
                id="mark-note"
                value={markPaidForm.note}
                onChange={(e) => setMarkPaidForm((curr) => ({ ...curr, note: e.target.value }))}
                placeholder="Payment confirmation code, transaction reference"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setMarkPaidOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Confirm Payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!itemToDelete}
        onOpenChange={(open) => !open && setItemToDelete(null)}
        title="Delete Investment?"
        description={`Are you sure you want to delete ${itemToDelete?.name || itemToDelete?.type}? This will permanently remove the investment and all its logs.`}
        onConfirm={deleteItem}
      />
      <ConfirmDialog
        open={!!contributionToRevert}
        onOpenChange={(open) => !open && setContributionToRevert(null)}
        title="Revert Installment Payment?"
        description="Are you sure you want to revert this installment payment? The associated expense entry and bank account debit will be permanently deleted and reversed."
        onConfirm={handleRevertPayment}
      />
      <LoaderOverlay show={isMutating} label={editing ? "Saving investment..." : "Updating investments..."} />
    </div>
  );
}

// LOCAL COMPONENT: FIXED TENURE PROGRESS CARD (fully responsive)
type CardProps = {
  item: InvestmentEntry;
  onEdit: (item: InvestmentEntry) => void;
  onDelete: (item: InvestmentEntry) => void;
  onExpand: (id: string) => void;
  isExpanded: boolean;
  contributions: ContributionEntry[];
  isLoadingContribs: boolean;
  onMarkPaid: (c: ContributionEntry, parent: InvestmentEntry) => void;
  onRevertPaid: (c: ContributionEntry) => void;
};

function FixedTenureCard({
  item,
  onEdit,
  onDelete,
  onExpand,
  isExpanded,
  contributions,
  isLoadingContribs,
  onMarkPaid,
  onRevertPaid,
}: CardProps) {
  const daysLeft = daysToMaturity(item.maturityDate!);
  const progressVal = tenureProgressPercent(item.startDate!, item.maturityDate!);

  let progressText = "";
  if (item.status === "Active") {
    progressText = daysLeft === 0 ? "Matures today" : daysLeft < 0 ? "Matured (Pending closure)" : `${daysLeft} days to maturity`;
  } else {
    const closedDate = item.actualClosureDate ? format(new Date(item.actualClosureDate), "dd MMM yyyy") : "";
    progressText = item.status === "Matured" ? `Matured on ${closedDate}` : `Closed Prematurely on ${closedDate}`;
  }

  const showMaturityText = item.status === "Active" ? "Projected Maturity" : "Actual Maturity Value";
  const maturityAmount =
    item.status === "Active"
      ? item.expectedMaturityAmount
      : item.actualMaturityAmount ?? item.expectedMaturityAmount;

  return (
    <div className="card p-5 flex flex-col justify-between gap-4 h-fit border hover:shadow-md transition-shadow">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{item.institution}</p>
            <h4 className="font-semibold text-foreground text-base leading-tight mt-0.5">
              {item.name || item.type}
            </h4>
            {item.planName && <p className="text-xs text-muted-foreground mt-0.5">{item.planName}</p>}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button variant="ghost" size="icon-sm" onClick={() => onEdit(item)} aria-label="Edit" />
                }
              >
                <Pencil className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => onDelete(item)}
                    aria-label="Delete"
                  />
                }
              >
                <Trash2 className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-2">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground">
            {item.investmentMode}
          </span>
          <StatusBadge status={item.status!} className="text-[10px]" />
          {item.accountOrPolicyNumber && (
            <span className="text-[10px] text-muted-foreground truncate max-w-36 font-mono self-center">
              #{item.accountOrPolicyNumber}
            </span>
          )}
        </div>
      </div>

      {/* Grid Fields */}
      <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-xs border-y py-3 my-1">
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-medium">
            {item.investmentMode === "Lumpsum" ? "Principal" : "Installment"}
          </span>
          <span className="font-semibold text-foreground text-sm">
            ₹
            {item.investmentMode === "Lumpsum"
              ? item.principalAmount?.toLocaleString()
              : `${item.installmentAmount?.toLocaleString()} / ${item.installmentFrequency === "Quarterly" ? "Qtr" : "Mo"}`}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-medium">Interest Rate</span>
          <span className="font-semibold text-foreground text-sm">{item.interestRate}% p.a.</span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-medium">Tenure</span>
          <span className="font-semibold text-foreground text-sm">
            {item.tenureValue} {item.tenureUnit}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground block text-[10px] uppercase font-medium">
            {showMaturityText}
          </span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
            <MoneyText value={maturityAmount || 0} />
          </span>
        </div>
      </div>

      {/* Progress section */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-medium">
          <span className={daysLeft <= 7 && item.status === "Active" ? "text-destructive font-semibold" : "text-muted-foreground"}>
            {progressText}
          </span>
          <span className="text-foreground">{progressVal}%</span>
        </div>
        <Progress value={progressVal} className="h-1.5 w-full bg-muted">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressVal}%` }} />
        </Progress>
        <p className="text-[10px] text-muted-foreground flex justify-between">
          <span>Started: {item.startDate ? format(new Date(item.startDate), "dd MMM yyyy") : ""}</span>
          <span>Matures: {item.maturityDate ? format(new Date(item.maturityDate), "dd MMM yyyy") : ""}</span>
        </p>
      </div>

      {/* Recurring Installments Toggle */}
      {item.investmentMode === "Recurring" && (
        <div className="mt-1 border-t pt-3">
          <Button
            variant="ghost"
            className="w-full justify-between h-8 text-xs font-semibold px-2 hover:bg-muted"
            onClick={() => onExpand(item.id)}
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle className="size-4 text-emerald-500" />
              Installment Schedule
              <span className="ml-1.5 font-normal text-muted-foreground">
                ({item.paidInstallments} of {item.totalInstallments} paid)
              </span>
            </span>
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>

          {isExpanded && (
            <div className="mt-3 space-y-2">
              {isLoadingContribs ? (
                <div className="text-center py-4 text-xs text-muted-foreground">Loading installments checklist...</div>
              ) : contributions.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">No installments scheduled.</div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {contributions.map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 rounded-lg border border-border text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-muted-foreground">
                          {format(new Date(c.dueDate), "dd MMM yyyy")}
                        </span>
                        <span className="font-semibold text-foreground">₹{c.amount.toLocaleString()}</span>
                        <StatusBadge status={c.status} className="text-[10px]" />
                      </div>
                      <div className="self-end sm:self-auto">
                        {c.status === "Paid" ? (
                          <Button
                            variant="ghost"
                            size="xs"
                            className="text-muted-foreground hover:text-destructive h-7 px-2"
                            onClick={() => onRevertPaid(c)}
                          >
                            Revert
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="xs"
                            className="h-7 px-2 border-primary text-primary hover:bg-primary/5"
                            onClick={() => onMarkPaid(c, item)}
                          >
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
