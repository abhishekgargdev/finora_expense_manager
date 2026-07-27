"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="relative flex flex-col items-center">
        <div className="absolute -top-12 animate-pulse text-destructive/20">
          <AlertCircle className="size-48 stroke-[0.5]" />
        </div>
        <h1 className="relative font-heading text-9xl font-extrabold tracking-tighter text-muted-foreground/30">404</h1>
        <h2 className="mt-4 font-heading text-2xl font-bold text-foreground">Page not found</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>
        <div className="mt-8">
          <Button render={<Link href="/dashboard" />} className="gap-2">
            <ArrowLeft className="size-4" /> Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
