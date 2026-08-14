"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import MoneyText from "@/components/finance/MoneyText";

type BankAccount = {
  id: string;
  bankName: string;
  accountName?: string;
  last4Digits?: string;
  currentBalance: number;
};

type PreSyncData = {
  accounts: BankAccount[];
  cashBalance: number;
  totalBankBalance: number;
};

type BankBalanceConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
};

export default function BankBalanceConfirmDialog({
  open,
  onOpenChange,
  onConfirmed,
}: BankBalanceConfirmDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [data, setData] = React.useState<PreSyncData | null>(null);
  const [balances, setBalances] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    void (async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/integrations/google-sheets/pre-sync");
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Failed to load bank balances.");
        setData(payload);
        setBalances(
          Object.fromEntries(
            payload.accounts.map((account: BankAccount) => [
              account.id,
              account.currentBalance.toFixed(2),
            ])
          )
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load bank balances.");
        onOpenChange(false);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, onOpenChange]);

  async function handleConfirm() {
    if (!data) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/integrations/google-sheets/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankConfirmed: true,
          confirmedBalances: data.accounts.map((account) => ({
            id: account.id,
            balance: Number(balances[account.id] ?? account.currentBalance),
          })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Sync failed.");
      toast.success("Data synced to Google Sheets.");
      onOpenChange(false);
      onConfirmed();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full">
        <DialogHeader>
          <DialogTitle>Confirm bank balances before sync</DialogTitle>
          <DialogDescription>
            Cross-check each bank balance with your actual account. Sync will only continue when the amounts match
            what is stored in the application.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading account balances...</p>
        ) : data ? (
          <div className="space-y-4">
            {data.accounts.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No bank accounts found. You can still continue if you only want to sync expenses, income, and lending.
              </p>
            ) : (
              <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-2 custom-scrollbar">
                {data.accounts.map((account) => (
                  <div key={account.id} className="rounded-xl border bg-card p-4 transition-colors hover:bg-muted/10">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading font-semibold text-foreground">
                            {account.bankName}
                          </p>
                          {account.last4Digits ? (
                            <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono font-medium">
                              •••• {account.last4Digits}
                            </span>
                          ) : null}
                        </div>
                        {account.accountName ? (
                          <p className="text-xs text-muted-foreground font-medium">{account.accountName}</p>
                        ) : null}
                        <p className="text-sm text-muted-foreground mt-1">
                          App balance:{" "}
                          <span className="font-semibold text-foreground money">
                            ₹{account.currentBalance.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                        </p>
                      </div>
                      <div className="w-full sm:w-48 space-y-1 shrink-0">
                        <Label htmlFor={`balance-${account.id}`} className="text-xs font-semibold text-muted-foreground">
                          Your bank balance
                        </Label>
                        <Input
                          id={`balance-${account.id}`}
                          type="number"
                          step="0.01"
                          value={balances[account.id] ?? ""}
                          onChange={(event) =>
                            setBalances((current) => ({ ...current, [account.id]: event.target.value }))
                          }
                          className="h-9 font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-xl bg-muted/40 p-4 text-sm border space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total bank balance in app:</span>
                <span className="font-semibold text-foreground money">
                  ₹{data.totalBankBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cash wallet:</span>
                <span className="font-semibold text-foreground money">
                  ₹{data.cashBalance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={syncing}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirm()} disabled={loading || syncing}>
            {syncing ? "Syncing..." : "Balances match, sync now"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
