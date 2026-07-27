"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import Loader from "@/components/loader/Loader";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setInstalled(true);
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const canInstall = useMemo(() => Boolean(deferredPrompt) && !installed, [deferredPrompt, installed]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && canInstall ? (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="fixed bottom-4 right-4 z-[1100] max-w-sm rounded-[24px] border border-border/70 bg-card/95 p-4 shadow-xl shadow-primary/10 backdrop-blur"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-primary/10 p-2">
              <Loader size="sm" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Install Expense Manager</p>
              <p className="mt-1 text-sm text-muted-foreground">Add it to your home screen for quick access.</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleInstall}
                  className="rounded-full bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
                >
                  Install
                </button>
                <button
                  onClick={() => setVisible(false)}
                  className="rounded-full border border-border px-3 py-2 text-sm font-medium"
                >
                  Dismiss
                </button>
              </div>
            </div>
            <button
              aria-label="Dismiss install banner"
              onClick={() => setVisible(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-muted"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
