"use client";

import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="flex flex-col items-center max-w-md">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive mb-6">
          <AlertTriangle className="size-8" />
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred while loading this page. Our team has been notified.
        </p>
        {error.message && (
          <code className="mt-4 block rounded-lg bg-muted p-3 text-left font-mono text-xs text-muted-foreground w-full overflow-x-auto">
            {error.message}
          </code>
        )}
        <div className="mt-8 flex gap-3">
          <Button variant="outline" onClick={() => window.location.assign("/dashboard")}>
            Go Home
          </Button>
          <Button onClick={() => reset()} className="gap-2">
            <RefreshCw className="size-4" /> Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}
