"use client";

import { AnimatePresence, motion } from "framer-motion";
import Loader from "./Loader";
import { cn } from "@/lib/utils";

interface LoaderOverlayProps {
  show: boolean;
  label?: string;
  className?: string;
}

export default function LoaderOverlay({ show, label, className }: LoaderOverlayProps) {
  return (
    <AnimatePresence>
      {show ? (
        <motion.div
          className={cn(
            "fixed inset-0 z-[1000] flex items-center justify-center bg-background/80 backdrop-blur-sm",
            className
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="rounded-[28px] border border-border/70 bg-card/95 p-6 shadow-xl shadow-primary/10"
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Loader size="lg" label={label ?? "Processing…"} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
