"use client";
import * as React from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, LoaderCircle, Upload, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const modules = ["income", "expense", "investment", "lending", "bank-transactions"] as const;
const labels: Record<(typeof modules)[number], string> = {
  income: "Income",
  expense: "Expense",
  investment: "Investment",
  lending: "Lending",
  "bank-transactions": "Bank Transactions",
};
const templates: Record<(typeof modules)[number], string[]> = {
  income: ["Amount", "Source", "Category", "Date", "Note", "Payment Mode"],
  expense: ["Amount", "Source", "Category", "Date", "Note", "Payment Mode"],
  investment: ["Type", "Name", "Amount Invested", "Current Value", "Date", "Note"],
  lending: ["Person", "Type", "Amount", "Amount Returned", "Date", "Due Date", "Note"],
  "bank-transactions": [
    "Bank Name",
    "Account Name",
    "Account Type",
    "Last 4 Digits",
    "Opening Balance",
    "Type",
    "Amount",
    "Description",
    "Date",
  ],
};
type Module = (typeof modules)[number];
export default function ImportExportPage() {
  const [importModule, setImportModule] = React.useState<Module>("income");
  const [exportModule, setExportModule] = React.useState<Module | "bank-accounts">("income");
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [fileName, setFileName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{
    inserted: number;
    failed: number;
    failures: { row: number; reason: string }[];
  } | null>(null);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  async function parseFile(file: File) {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      if (!parsed.length) return toast.error("No data rows were found in this file.");
      setRows(parsed);
      setFileName(file.name);
      setResult(null);
      toast.success(`${parsed.length} rows ready to review.`);
    } catch {
      toast.error("We couldn't read that spreadsheet.");
    }
  }
  function template() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([templates[importModule]]), labels[importModule]);
    XLSX.writeFile(workbook, `${importModule}-template.xlsx`);
  }
  async function importRows() {
    if (!rows.length) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/import/${importModule}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Import failed.");
      setResult(payload);
      if (payload.inserted) toast.success(`${payload.inserted} rows imported.`);
      if (payload.failed) toast.error(`${payload.failed} rows need attention.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  async function download(url: string, name: string) {
    setBusy(true);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error ?? "Export failed.");
      }
      const blob = await response.blob();
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(blob);
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      toast.success("Your export is downloading.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  const headers = rows.length ? Object.keys(rows[0]) : templates[importModule];
  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-2xl font-semibold">Import / Export</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Move your finance data in and out of the tracker with Excel-compatible files.
        </p>
      </div>
      <section className="card p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Upload />
          </div>
          <div>
            <h3 className="font-heading font-semibold">Import data</h3>
            <p className="text-sm text-muted-foreground">
              Download a template, add your records, then review before importing.
            </p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[15rem_1fr]">
          <div className="grid gap-2">
            <Label>Module</Label>
            <Select
              value={importModule}
              onValueChange={(value) => {
                setImportModule(value as Module);
                setRows([]);
                setFileName("");
                setResult(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module} value={module}>
                    {labels[module]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="mt-2" onClick={template}>
              <Download />
              Download template
            </Button>
          </div>
          <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-primary/35 bg-primary/5 p-5 text-center transition-colors hover:bg-primary/10">
            <UploadCloud className="size-8 text-primary" />
            <span className="mt-2 font-medium">Drop an .xlsx or .csv here</span>
            <span className="mt-1 text-sm text-muted-foreground">or choose a file to preview it</span>
            <Input
              className="sr-only"
              type="file"
              accept=".xlsx,.csv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void parseFile(file);
              }}
            />
            <span className="mt-2 text-xs text-muted-foreground">{fileName || "Excel or CSV only"}</span>
          </label>
        </div>
        {rows.length > 0 && (
          <div className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-medium">Preview</h4>
                <p className="text-sm text-muted-foreground">
                  Showing the first {Math.min(rows.length, 10)} of {rows.length} rows.
                </p>
              </div>
              <Button onClick={() => void importRows()}>
                <Upload />
                Confirm import
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 10).map((row, index) => (
                    <TableRow key={index}>
                      {headers.map((header) => (
                        <TableCell key={header}>{String(row[header] ?? "")}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
        {result && (
          <div
            className={`mt-5 rounded-lg border p-4 ${result.failed ? "border-pending/30 bg-pending-10" : "border-settled/30 bg-settled-10"}`}
          >
            <p className="font-medium">
              Import complete: {result.inserted} successful, {result.failed} failed.
            </p>
            {result.failures.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {result.failures.slice(0, 5).map((failure) => (
                  <li key={failure.row}>
                    Row {failure.row}: {failure.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      <section className="card p-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-investment-10 text-investment">
            <FileSpreadsheet />
          </div>
          <div>
            <h3 className="font-heading font-semibold">Export data</h3>
            <p className="text-sm text-muted-foreground">Download selected records or a complete multi-sheet backup.</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label>Module</Label>
            <Select value={exportModule} onValueChange={(value) => setExportModule(value as Module | "bank-accounts")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module} value={module}>
                    {labels[module]}
                  </SelectItem>
                ))}
                <SelectItem value="bank-accounts">Bank Accounts</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>
              From <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>
              To <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            onClick={() =>
              void download(
                `/api/export/${exportModule}?${new URLSearchParams({ ...(from ? { from } : {}), ...(to ? { to } : {}) })}`,
                `${exportModule}.xlsx`
              )
            }
          >
            <Download />
            Export to Excel
          </Button>
          <Button variant="outline" onClick={() => void download("/api/export/all", "finance-tracker-export.xlsx")}>
            <FileSpreadsheet />
            Export All Data
          </Button>
        </div>
      </section>
      <LoaderOverlay show={busy} label="Processing your data..." />
    </div>
  );
}
