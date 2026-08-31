"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Code,
  FileText,
  Brain,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Percent,
  Coins,
  Copy,
  Check,
  RefreshCw,
  Eye,
  Sliders,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { fadeInUp, staggerContainer } from "@/lib/motion";
import MoneyText from "./MoneyText";

interface AIFinancialProfile {
  summary: {
    totalIncome: number;
    totalExpenses: number;
    totalInvested: number;
    netSavings: number;
    savingsRatePercentage: number;
    bankBalance: number;
    cashBalance: number;
  };
  incomeRecords: unknown[];
  expenseSummary: {
    categoryBreakdown: Record<string, number>;
    monthlyTrend: unknown[];
    recentExpenses: unknown[];
  };
  investmentRecords: unknown[];
}

const PRESETS = [
  "Where am I making financial mistakes in my spending habits?",
  "Evaluate my investments and suggest diversification options.",
  "How can I improve my monthly savings rate based on my current income?",
  "Give me a customized budget optimization strategy.",
];

export default function AIAdvisorClient() {
  const [data, setData] = React.useState<AIFinancialProfile | null>(null);
  const [loadingData, setLoadingData] = React.useState(true);
  const [generating, setGenerating] = React.useState(false);
  const [userMessage, setUserMessage] = React.useState("");
  const [includeIncome, setIncludeIncome] = React.useState(true);
  const [includeExpenses, setIncludeExpenses] = React.useState(true);
  const [includeInvestments, setIncludeInvestments] = React.useState(true);
  const [analysisResult, setAnalysisResult] = React.useState<string | null>(null);
  const [copiedText, setCopiedText] = React.useState(false);

  // Load user data on mount
  React.useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoadingData(true);
    try {
      const res = await fetch("/api/ai/data");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        toast.error("Failed to load financial workspace data.");
      }
    } catch (err) {
      toast.error("An error occurred while loading data.");
    } finally {
      setLoadingData(false);
    }
  }

  // Create prompt representation for review
  const filteredData = React.useMemo(() => {
    if (!data) return {};
    const filtered: {
      summary: {
        netSavings: number;
        savingsRatePercentage: number;
        bankBalance: number;
        cashBalance: number;
        totalIncome?: number;
        totalExpenses?: number;
        totalInvested?: number;
      };
      incomeRecords?: unknown[];
      expenseSummary?: unknown;
      investmentRecords?: unknown[];
    } = {
      summary: {
        netSavings: data.summary.netSavings,
        savingsRatePercentage: data.summary.savingsRatePercentage,
        bankBalance: data.summary.bankBalance,
        cashBalance: data.summary.cashBalance,
      },
    };

    if (includeIncome) {
      filtered.summary.totalIncome = data.summary.totalIncome;
      filtered.incomeRecords = data.incomeRecords;
    }
    if (includeExpenses) {
      filtered.summary.totalExpenses = data.summary.totalExpenses;
      filtered.expenseSummary = data.expenseSummary;
    }
    if (includeInvestments) {
      filtered.summary.totalInvested = data.summary.totalInvested;
      filtered.investmentRecords = data.investmentRecords;
    }
    return filtered;
  }, [data, includeIncome, includeExpenses, includeInvestments]);

  async function handleAnalyze() {
    setGenerating(true);
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          includeIncome,
          includeExpenses,
          includeInvestments,
        }),
      });

      const result = await res.json();
      if (res.ok && result.analysis) {
        setAnalysisResult(result.analysis);
        toast.success("Financial advisory generated successfully!");
      } else {
        toast.error(result.error || "Failed to generate AI analysis.");
      }
    } catch (err) {
      toast.error("Network error occurred during AI analysis.");
    } finally {
      setGenerating(false);
    }
  }

  function handleCopy() {
    if (!analysisResult) return;
    navigator.clipboard.writeText(analysisResult);
    setCopiedText(true);
    toast.success("Analysis copied to clipboard!");
    setTimeout(() => setCopiedText(false), 2000);
  }

  // Elegant Safe Markdown Parser
  function renderMarkdown(md: string) {
    if (!md) return null;
    const lines = md.split("\n");

    const renderLineWithBold = (text: string) => {
      // Parses bold tag matches **text**
      const parts = text.split(/(\*\*.*?\*\*)/g);
      return parts.map((part, idx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={idx} className="font-semibold text-foreground">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });
    };

    return (
      <div className="space-y-4 text-foreground/90 leading-relaxed">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-2" />;

          // Headers
          if (trimmed.startsWith("### ")) {
            return (
              <h3 key={idx} className="font-heading text-lg font-semibold text-primary pt-3 pb-1 border-b border-border/40">
                {renderLineWithBold(trimmed.slice(4))}
              </h3>
            );
          }
          if (trimmed.startsWith("## ")) {
            return (
              <h2 key={idx} className="font-heading text-xl font-bold text-foreground pt-4 pb-1">
                {renderLineWithBold(trimmed.slice(3))}
              </h2>
            );
          }
          if (trimmed.startsWith("# ")) {
            return (
              <h1 key={idx} className="font-heading text-2xl font-black text-foreground pt-5 pb-2">
                {renderLineWithBold(trimmed.slice(2))}
              </h1>
            );
          }

          // Bullet lists
          if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
            return (
              <div key={idx} className="flex gap-2.5 items-start pl-3">
                <span className="mt-1.5 size-1.5 rounded-full bg-primary/70 shrink-0" />
                <span className="text-sm">{renderLineWithBold(trimmed.slice(2))}</span>
              </div>
            );
          }

          // Number lists
          const numMatch = trimmed.match(/^(\d+)\.\s(.*)/);
          if (numMatch) {
            return (
              <div key={idx} className="flex gap-3 items-start pl-3 bg-muted/20 p-2.5 rounded-lg border border-border/20">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shrink-0">
                  {numMatch[1]}
                </span>
                <span className="text-sm">{renderLineWithBold(numMatch[2])}</span>
              </div>
            );
          }

          // Paragraph
          return (
            <p key={idx} className="text-sm">
              {renderLineWithBold(trimmed)}
            </p>
          );
        })}
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <RefreshCw className="size-8 text-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Gathering your financial workspace...</p>
      </div>
    );
  }

  return (
    <motion.div
      className="space-y-6 max-w-6xl mx-auto"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Intro Header */}
      <motion.div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center" variants={fadeInUp}>
        <div>
          <div className="flex items-center gap-2 text-primary font-medium text-sm">
            <Sparkles className="size-4 animate-pulse" />
            <span>Powered by Gemini & NVIDIA AI Chain</span>
          </div>
          <h2 className="font-heading text-2xl font-semibold mt-1">AI Financial Advisor</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audit your cashflow, check spending anomalies, and receive personalized investment opportunities.
          </p>
        </div>
      </motion.div>

      {/* Summary Cards */}
      {data && (
        <motion.div className="grid gap-4 grid-cols-2 md:grid-cols-4" variants={fadeInUp}>
          <Card className="hover:border-primary/20 transition-all duration-300">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Savings Rate</CardDescription>
              <CardTitle className="text-xl font-bold flex items-center gap-1.5">
                <Percent className="size-4.5 text-primary" />
                <span>{data.summary.savingsRatePercentage}%</span>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="hover:border-primary/20 transition-all duration-300">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Total Net Savings</CardDescription>
              <CardTitle className="text-xl font-bold text-income">
                <MoneyText value={data.summary.netSavings} />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="hover:border-primary/20 transition-all duration-300">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Bank Assets</CardDescription>
              <CardTitle className="text-xl font-bold">
                <MoneyText value={data.summary.bankBalance} />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="hover:border-primary/20 transition-all duration-300">
            <CardHeader className="p-4 pb-2">
              <CardDescription className="text-xs">Invested Assets</CardDescription>
              <CardTitle className="text-xl font-bold text-investment">
                <MoneyText value={data.summary.totalInvested} />
              </CardTitle>
            </CardHeader>
          </Card>
        </motion.div>
      )}

      {/* Main Layout Grid */}
      <motion.div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]" variants={fadeInUp}>
        
        {/* Left Side: Advisor Control Console */}
        <div className="space-y-6">
          <Card className="glassmorphism-card border border-border/50 shadow-md">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sliders className="size-4.5 text-primary" />
                Advisor Settings
              </CardTitle>
              <CardDescription className="text-xs">
                Toggle data parameters and write custom instructions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Toggles */}
              <div className="space-y-3.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Include Financial Metrics</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label htmlFor="toggle-income" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <Coins className="size-4 text-income" />
                      Incomes log
                    </label>
                    <Switch id="toggle-income" checked={includeIncome} onCheckedChange={setIncludeIncome} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="toggle-expenses" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <Wallet className="size-4 text-expense" />
                      Expense aggregates
                    </label>
                    <Switch id="toggle-expenses" checked={includeExpenses} onCheckedChange={setIncludeExpenses} />
                  </div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="toggle-investments" className="text-sm font-medium flex items-center gap-2 cursor-pointer">
                      <TrendingUp className="size-4 text-investment" />
                      Investments profile
                    </label>
                    <Switch id="toggle-investments" checked={includeInvestments} onCheckedChange={setIncludeInvestments} />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Message / Question Panel */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Specific Question (Optional)</label>
                <textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="e.g. Can I afford to buy a car next year? Am I spending too much on entertainment?"
                  className="w-full min-h-[100px] text-sm bg-muted/40 p-3 rounded-lg border border-border/80 outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                />
              </div>

              {/* Presets */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Quick Prompts</span>
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setUserMessage(preset)}
                      className="text-left text-xs bg-muted/30 hover:bg-muted/80 text-foreground/80 hover:text-foreground px-3 py-1.5 rounded-lg border border-border/40 transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleAnalyze}
                disabled={generating || (!includeIncome && !includeExpenses && !includeInvestments)}
                className="w-full flex justify-center items-center gap-2 hover:scale-[1.01] active:scale-[0.99] transition-all py-5"
              >
                {generating ? (
                  <>
                    <RefreshCw className="size-4.5 animate-spin" />
                    <span>Analyzing Finances...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4.5" />
                    <span>Request AI Audit</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Tab Explorer */}
        <div className="min-w-0">
          <Tabs defaultValue="insights" className="w-full">
            <div className="flex justify-between items-center bg-muted/30 p-1.5 rounded-xl border border-border/40 mb-4">
              <TabsList className="bg-transparent border-0 gap-1.5">
                <TabsTrigger value="insights" className="gap-1.5 text-xs">
                  <Brain className="size-4" /> Insights
                </TabsTrigger>
                <TabsTrigger value="prompt" className="gap-1.5 text-xs">
                  <FileText className="size-4" /> Prompt
                </TabsTrigger>
                <TabsTrigger value="data" className="gap-1.5 text-xs">
                  <Code className="size-4" /> Data Shared
                </TabsTrigger>
              </TabsList>
              
              {analysisResult && (
                <Button variant="ghost" size="icon" onClick={handleCopy} className="size-8 hover:bg-muted">
                  {copiedText ? <Check className="size-4 text-green-500" /> : <Copy className="size-4 text-foreground/70" />}
                </Button>
              )}
            </div>

            {/* TAB: Insights */}
            <TabsContent value="insights" className="outline-none mt-0">
              <Card className="min-h-[460px] border border-border/50 shadow-xs flex flex-col">
                <CardContent className="p-6 flex-1 flex flex-col justify-center">
                  <AnimatePresence mode="wait">
                    {generating ? (
                      <motion.div
                        key="generating"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-20 text-center gap-4"
                      >
                        <div className="relative">
                          <Brain className="size-12 text-primary animate-pulse" />
                          <Sparkles className="absolute -top-1.5 -right-1.5 size-5 text-primary animate-bounce" />
                        </div>
                        <div>
                          <h4 className="font-heading text-sm font-semibold">AI Chain is Auditing Your Ledger...</h4>
                          <p className="text-xs text-muted-foreground max-w-sm mt-1">
                            We are compiling your category ratios, checking saving patterns, and structuring a personalized analysis.
                          </p>
                        </div>
                      </motion.div>
                    ) : analysisResult ? (
                      <motion.div
                        key="result"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="py-2"
                      >
                        {renderMarkdown(analysisResult)}
                      </motion.div>
                    ) : (
                      <motion.div
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center py-20 text-center gap-3"
                      >
                        <Sparkles className="size-10 text-primary/30" />
                        <div>
                          <h4 className="font-heading text-sm font-semibold">No Advisory Requested Yet</h4>
                          <p className="text-xs text-muted-foreground max-w-xs mt-1">
                            Set your preferences on the console and click "Request AI Audit" to start.
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Prompt Details */}
            <TabsContent value="prompt" className="outline-none mt-0">
              <Card className="border border-border/50 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="size-4.5 text-primary" />
                    System Instruction Prompt
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="bg-muted/40 p-4 rounded-lg border border-border/60 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {`System Instruction:
You are a highly skilled, professional, and empathetic AI Financial Advisor.
Your goal is to analyze the user's financial profile (incomes, expenses, and investments) and provide deep insights, advice, and constructive criticism.

Address the following aspects in detail:
1. Financial Health & Spending Habits: Identify potential mistakes, excessive spending, or warning signs...
2. Investment Strategy: Analyze their current asset allocation...
3. Actionable Checklist: Provide a prioritized, bulleted list...`}
                  </div>
                  <h4 className="text-xs font-bold text-foreground mt-4 mb-2 flex items-center gap-1.5">
                    <Eye className="size-4 text-primary" /> User Instructions Prompt Template
                  </h4>
                  <div className="bg-muted/40 p-4 rounded-lg border border-border/60 text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                    {`Below is my financial data (including incomes, expenses, and investments):

[Selected Data JSON payload matches "Data Shared" tab]

${
  userMessage
    ? `I have this specific question or concern: "${userMessage}"\n\nPlease answer my question/concern, and also integrate it into your general review of my finances.`
    : "Please perform a general review and provide your financial analysis and advisory recommendations."
}`}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB: Raw Data Shared */}
            <TabsContent value="data" className="outline-none mt-0">
              <Card className="border border-border/50 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Code className="size-4.5 text-primary" />
                    Payload Inspector
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <p className="text-xs text-muted-foreground mb-3">
                    Below is the live filtered JSON context compiled client-side based on your settings.
                  </p>
                  <pre className="bg-muted/40 p-4 rounded-lg border border-border/60 text-xs font-mono overflow-auto max-h-[500px] text-foreground/90">
                    {JSON.stringify(filteredData, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

      </motion.div>
    </motion.div>
  );
}
