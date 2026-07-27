"use client";

import * as React from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Cell, Pie, PieChart } from "recharts";
import { CalendarDays, ChartNoAxesCombined, Pencil, Plus, Trash2, WalletCards } from "lucide-react";
import { toast } from "sonner";
import EmptyState from "@/components/finance/EmptyState";
import MoneyText from "@/components/finance/MoneyText";
import StatCard from "@/components/finance/StatCard";
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
import { staggerContainer } from "@/lib/motion";
import { type InvestmentEntry, type InvestmentInput, useInvestments } from "@/hooks/useInvestments";

const TYPES = ["Mutual Fund", "Stocks", "FD", "RD", "Gold", "Crypto", "PPF", "Other"];
const COLORS = [
  "var(--investment)",
  "var(--primary)",
  "var(--secondary)",
  "var(--income)",
  "#ca8a04",
  "#db2777",
  "#0891b2",
  "#64748b",
];
const chartConfig = Object.fromEntries(
  TYPES.map((type, index) => [type, { label: type, color: COLORS[index] }])
) satisfies ChartConfig;
type FormState = {
  type: string;
  name: string;
  amountInvested: string;
  currentValue: string;
  date: string;
  note: string;
};
const emptyForm = (): FormState => ({
  type: "Mutual Fund",
  name: "",
  amountInvested: "",
  currentValue: "",
  date: format(new Date(), "yyyy-MM-dd"),
  note: "",
});
const toForm = (item: InvestmentEntry): FormState => ({
  type: item.type,
  name: item.name ?? "",
  amountInvested: String(item.amountInvested),
  currentValue: String(item.currentValue),
  date: format(new Date(item.date), "yyyy-MM-dd"),
  note: item.note ?? "",
});

export default function InvestmentsPage() {
  const { investments, isLoading, isMutating, create, update, remove } = useInvestments();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<InvestmentEntry | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);
  const totalInvested = investments.reduce((sum, item) => sum + item.amountInvested, 0);
  const totalCurrent = investments.reduce((sum, item) => sum + item.currentValue, 0);
  const gain = totalCurrent - totalInvested;
  const gainPercent = totalInvested ? (gain / totalInvested) * 100 : 0;
  const chartData = TYPES.map((type, index) => ({
    type,
    value: investments.filter((item) => item.type === type).reduce((sum, item) => sum + item.currentValue, 0),
    fill: COLORS[index],
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
    const amountInvested = Number(form.amountInvested);
    const currentValue = Number(form.currentValue || form.amountInvested);
    if (!Number.isFinite(amountInvested) || amountInvested <= 0 || !Number.isFinite(currentValue) || currentValue < 0)
      return toast.error("Enter valid investment amounts.");
    const payload: InvestmentInput = {
      type: form.type,
      name: form.name.trim() || undefined,
      amountInvested,
      currentValue,
      date: new Date(`${form.date}T12:00:00`).toISOString(),
      note: form.note.trim() || undefined,
    };
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
  async function deleteItem(item: InvestmentEntry) {
    if (!window.confirm(`Delete ${item.name || item.type}?`)) return;
    try {
      await remove(item.id);
      toast.success("Investment deleted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete investment.");
    }
  }
  if (isLoading) return <PageSkeleton variant="chart" />;
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-heading text-2xl font-semibold">Investments</h2>
          <p className="mt-1 text-sm text-muted-foreground">Monitor contributions, present value, and performance.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus />
          Add Investment
        </Button>
      </div>
      <motion.div className="grid gap-4 md:grid-cols-3" variants={staggerContainer} initial="hidden" animate="show">
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<WalletCards />} label="Total Invested" value={totalInvested} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <StatCard icon={<ChartNoAxesCombined />} label="Total Current Value" value={totalCurrent} />
        </motion.div>
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}>
          <div className="card p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-investment-10 text-investment">
                <ChartNoAxesCombined />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overall Gain / Loss</p>
                <MoneyText
                  value={gain}
                  variant={gain >= 0 ? "positive" : "negative"}
                  className="mt-1 text-2xl font-semibold"
                />
                <p className={gain >= 0 ? "mt-1 text-sm text-settled" : "mt-1 text-sm text-expense"}>
                  {gain >= 0 ? "+" : ""}
                  {gainPercent.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
      {investments.length === 0 ? (
        <EmptyState
          icon={<ChartNoAxesCombined />}
          title="No investments yet"
          description="Add your first holding to see allocation and performance."
          action={
            <Button onClick={openCreate}>
              <Plus />
              Add your first investment
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Invested</TableHead>
                  <TableHead className="text-right">Current value</TableHead>
                  <TableHead className="text-right">Gain / Loss</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {investments.map((item) => {
                  const difference = item.currentValue - item.amountInvested;
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.type}</TableCell>
                      <TableCell>
                        <div className="font-medium">{item.name || "Untitled"}</div>
                        {item.note && (
                          <div className="max-w-40 truncate text-xs text-muted-foreground">{item.note}</div>
                        )}
                      </TableCell>
                      <TableCell>{format(new Date(item.date), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right">
                        <MoneyText value={item.amountInvested} />
                      </TableCell>
                      <TableCell className="text-right">
                        <MoneyText value={item.currentValue} />
                      </TableCell>
                      <TableCell className="text-right">
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
                                  aria-label="Edit investment"
                                />
                              }
                            >
                              <Pencil />
                            </TooltipTrigger>
                            <TooltipContent>Edit investment</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => void deleteItem(item)}
                                  aria-label="Delete investment"
                                />
                              }
                            >
                              <Trash2 />
                            </TooltipTrigger>
                            <TooltipContent>Delete investment</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <section className="card p-4">
            <h3 className="font-heading text-sm font-semibold">Distribution by type</h3>
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit investment" : "Add investment"}</DialogTitle>
            <DialogDescription>Record a holding and its latest value.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={form.type} onValueChange={(value) => change("type", value ?? "Other")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="investment-name">
                  Name <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="investment-name"
                  value={form.name}
                  onChange={(event) => change("name", event.target.value)}
                  placeholder="Fund or asset name"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="amount-invested">Amount invested</Label>
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
                <Label htmlFor="current-value">Current value</Label>
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
                    onSelect={(date) => date && change("date", format(date, "yyyy-MM-dd"))}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="investment-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input id="investment-note" value={form.note} onChange={(event) => change("note", event.target.value)} />
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
      <LoaderOverlay show={isMutating} label={editing ? "Saving investment..." : "Updating investments..."} />
    </div>
  );
}
