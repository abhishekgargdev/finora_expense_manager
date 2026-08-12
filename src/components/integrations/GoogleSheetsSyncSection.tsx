"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { FileSpreadsheet, Link2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import BankBalanceConfirmDialog from "@/components/integrations/BankBalanceConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

type SyncConfig = {
  connected: boolean;
  enabled: boolean;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  spreadsheetName?: string;
  connectedEmail?: string;
  scheduleType: "interval" | "monthly" | "yearly";
  intervalDays: number;
  dayOfMonth: number;
  monthOfYear: number;
  dayOfYear: number;
  lastSyncedAt?: string;
  nextSyncAt?: string;
  daysUntilSync?: number | null;
  lastSyncStatus?: "success" | "failed" | "pending";
  lastSyncError?: string;
  oauthConfigured: boolean;
};

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Date(2026, index, 1).toLocaleString("default", { month: "long" }),
}));

export default function GoogleSheetsSyncSection() {
  const searchParams = useSearchParams();
  const [config, setConfig] = React.useState<SyncConfig | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const loadConfig = React.useCallback(async () => {
    const response = await fetch("/api/integrations/google-sheets");
    if (!response.ok) return;
    const payload = (await response.json()) as SyncConfig;
    setConfig(payload);
    setSpreadsheetUrl(payload.spreadsheetUrl ?? "");
  }, []);

  React.useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  React.useEffect(() => {
    const status = searchParams.get("google");
    const message = searchParams.get("message");
    if (status === "connected") toast.success("Google account connected.");
    if (status === "error") toast.error(message ? decodeURIComponent(message) : "Google authorization failed.");
  }, [searchParams]);

  async function saveConfig(partial: Partial<SyncConfig>) {
    setBusy(true);
    try {
      const response = await fetch("/api/integrations/google-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...partial,
          spreadsheetUrl: partial.spreadsheetUrl ?? spreadsheetUrl,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to save settings.");
      setConfig(payload);
      toast.success("Google Sheets settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setBusy(false);
    }
  }

  async function connectGoogle() {
    setBusy(true);
    try {
      const response = await fetch("/api/integrations/google-sheets/auth");
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to start Google authorization.");
      window.location.href = payload.url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect Google account.");
      setBusy(false);
    }
  }

  async function disconnectGoogle() {
    setBusy(true);
    try {
      const response = await fetch("/api/integrations/google-sheets/disconnect", { method: "DELETE" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to disconnect.");
      await loadConfig();
      toast.success("Google account disconnected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to disconnect.");
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return <p className="text-sm text-muted-foreground">Loading Google Sheets settings...</p>;
  }

  return (
    <>
      <LoaderOverlay show={busy} />
      <section className="card space-y-6 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <FileSpreadsheet className="size-5" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-semibold">Google Sheets sync</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Export expenses by month, plus dedicated sheets for income, lending, investments, and bank accounts.
              New records are appended without overwriting existing sheet data.
            </p>
          </div>
        </div>

        {!config.oauthConfigured ? (
          <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and optionally `GOOGLE_REDIRECT_URI` to your environment
            before connecting Google Sheets.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="spreadsheet-url">Google Sheet URL or ID</Label>
            <Input
              id="spreadsheet-url"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={spreadsheetUrl}
              onChange={(event) => setSpreadsheetUrl(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Sync schedule</Label>
            <Select
              value={config.scheduleType}
              onValueChange={(value) =>
                setConfig((current) =>
                  current ? { ...current, scheduleType: value as SyncConfig["scheduleType"] } : current
                )
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interval">Every N days</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {config.scheduleType === "interval" ? (
          <div className="space-y-2">
            <Label htmlFor="interval-days">Sync every (days)</Label>
            <Input
              id="interval-days"
              type="number"
              min={1}
              max={365}
              value={config.intervalDays}
              onChange={(event) =>
                setConfig((current) =>
                  current ? { ...current, intervalDays: Number(event.target.value) } : current
                )
              }
            />
          </div>
        ) : null}

        {config.scheduleType === "monthly" ? (
          <div className="space-y-2">
            <Label>Day of month</Label>
            <Select
              value={String(config.dayOfMonth)}
              onValueChange={(value) =>
                setConfig((current) => (current ? { ...current, dayOfMonth: Number(value) } : current))
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, index) => (
                  <SelectItem key={index + 1} value={String(index + 1)}>
                    Day {index + 1}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {config.scheduleType === "yearly" ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Month</Label>
              <Select
                value={String(config.monthOfYear)}
                onValueChange={(value) =>
                  setConfig((current) => (current ? { ...current, monthOfYear: Number(value) } : current))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Day</Label>
              <Select
                value={String(config.dayOfYear)}
                onValueChange={(value) =>
                  setConfig((current) => (current ? { ...current, dayOfYear: Number(value) } : current))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 28 }, (_, index) => (
                    <SelectItem key={index + 1} value={String(index + 1)}>
                      Day {index + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="font-medium">Enable scheduled sync reminders</p>
            <p className="text-sm text-muted-foreground">
              Dashboard will remind you 2 days before the next sync so you can cross-check balances.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(checked) => setConfig((current) => (current ? { ...current, enabled: checked } : current))}
          />
        </div>

        <div className="rounded-xl bg-muted/40 p-4 text-sm">
          <p>
            Connection:{" "}
            {config.connected ? (
              <span className="font-medium text-income">{config.connectedEmail ?? "Connected"}</span>
            ) : (
              <span className="text-muted-foreground">Not connected</span>
            )}
          </p>
          {config.spreadsheetName ? <p className="mt-1">Spreadsheet: {config.spreadsheetName}</p> : null}
          {config.lastSyncedAt ? (
            <p className="mt-1">Last synced: {new Date(config.lastSyncedAt).toLocaleString()}</p>
          ) : null}
          {config.nextSyncAt ? (
            <p className="mt-1">Next sync: {new Date(config.nextSyncAt).toLocaleDateString()}</p>
          ) : null}
          {config.lastSyncStatus === "failed" && config.lastSyncError ? (
            <p className="mt-2 text-expense">{config.lastSyncError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() =>
              void saveConfig({
                enabled: config.enabled,
                scheduleType: config.scheduleType,
                intervalDays: config.intervalDays,
                dayOfMonth: config.dayOfMonth,
                monthOfYear: config.monthOfYear,
                dayOfYear: config.dayOfYear,
                spreadsheetUrl,
              })
            }
          >
            Save settings
          </Button>

          {config.connected ? (
            <Button variant="outline" onClick={() => void disconnectGoogle()}>
              <Unplug className="size-4" />
              Disconnect Google
            </Button>
          ) : (
            <Button variant="outline" onClick={() => void connectGoogle()} disabled={!config.oauthConfigured}>
              <Link2 className="size-4" />
              Connect Google account
            </Button>
          )}

          <Button
            variant="secondary"
            onClick={() => setConfirmOpen(true)}
            disabled={!config.connected || !spreadsheetUrl}
          >
            <RefreshCw className="size-4" />
            Sync now
          </Button>
        </div>
      </section>

      <BankBalanceConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirmed={() => void loadConfig()}
      />
    </>
  );
}
