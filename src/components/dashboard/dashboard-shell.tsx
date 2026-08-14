"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import {
  CreditCard,
  Handshake,
  Home,
  Landmark,
  LogOut,
  Moon,
  PiggyBank,
  Settings,
  Sun,
  Tags,
  TrendingDown,
  TrendingUp,
  Upload,
  Banknote,
  Users,
  Plus,
  Sparkles,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import LoaderOverlay from "@/components/loader/LoaderOverlay";
import useUser from "@/hooks/useUser";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu";

const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: Home },
  { title: "AI Advisor", href: "/ai-advisor", icon: Sparkles },
  { title: "Income", href: "/income", icon: TrendingUp },
  { title: "Expenses", href: "/expenses", icon: TrendingDown },
  { title: "Categories", href: "/categories", icon: Tags },
  { title: "Investments", href: "/investments", icon: PiggyBank },
  { title: "Lending", href: "/lending", icon: Handshake },
  { title: "Group Expenses", href: "/group-expenses", icon: Users },
  { title: "Credit Cards", href: "/credit-cards", icon: CreditCard },
  { title: "Bank Accounts", href: "/bank-accounts", icon: Landmark },
  { title: "Cash Wallet", href: "/cash-wallet", icon: Banknote },
  { title: "Import / Export", href: "/import-export", icon: Upload },
];

const primaryNavigation = [
  { title: "Dashboard", href: "/dashboard", icon: Home },
  { title: "AI Advisor", href: "/ai-advisor", icon: Sparkles },
  { title: "Income", href: "/income", icon: TrendingUp },
  { title: "Expenses", href: "/expenses", icon: TrendingDown },
  { title: "Categories", href: "/categories", icon: Tags },
];

const secondaryNavigation = [
  // Alternate: Outer, Inner, Outer, Inner, Outer, Inner, Outer, Inner
  { title: "Investments", href: "/investments", icon: PiggyBank, arc: "outer", angle: 15 },
  { title: "Bank Accounts", href: "/bank-accounts", icon: Landmark, arc: "inner", angle: 35 },
  { title: "Lending", href: "/lending", icon: Handshake, arc: "outer", angle: 55 },
  { title: "Cash Wallet", href: "/cash-wallet", icon: Banknote, arc: "inner", angle: 75 },
  { title: "Group Expenses", href: "/group-expenses", icon: Users, arc: "outer", angle: 105 },
  { title: "Credit Cards", href: "/credit-cards", icon: CreditCard, arc: "inner", angle: 125 },
  { title: "Settings", href: "/settings", icon: Settings, arc: "outer", angle: 145 },
  { title: "Import / Export", href: "/import-export", icon: Upload, arc: "inner", angle: 165 },
];

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/ai-advisor": "AI Advisor",
  "/income": "Income",
  "/expenses": "Expenses",
  "/categories": "Categories",
  "/investments": "Investments",
  "/lending": "Lending",
  "/group-expenses": "Group Expenses",
  "/credit-cards": "Credit Cards",
  "/bank-accounts": "Bank Accounts",
  "/cash-wallet": "Cash Wallet",
  "/import-export": "Import / Export",
  "/settings": "Settings",
};

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function initials(name?: string | null) {
  return (
    name
      ?.split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "U"
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUser();
  const { resolvedTheme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const title = routeTitles[pathname] ?? "Finance Tracker";

  React.useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function signOut() {
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-sidebar-border">
        <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3">
          <div
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 overflow-hidden font-heading font-semibold text-sidebar-foreground cursor-pointer"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
              F
            </span>
            <span className="truncate group-data-[collapsible=icon]:hidden">Finora</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          <SidebarGroup className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {navigation.map((item) => {
                  const active = isActiveRoute(pathname, item.href);
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.title}
                        className={cn(
                          "relative h-10 overflow-hidden text-sidebar-foreground/70 hover:bg-primary/8 hover:text-primary",
                          active && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary"
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="active-nav"
                            className="absolute inset-0 rounded-md bg-primary/10"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                          />
                        )}
                        <Icon className="relative z-10" />
                        <span className="relative z-10">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/settings" />}
                isActive={isActiveRoute(pathname, "/settings")}
                tooltip="Settings"
                className={cn(
                  "relative h-10 overflow-hidden text-sidebar-foreground/70 hover:bg-primary/8 hover:text-primary",
                  isActiveRoute(pathname, "/settings") && "bg-primary/10 font-medium text-primary"
                )}
              >
                {isActiveRoute(pathname, "/settings") && (
                  <motion.span
                    layoutId="active-nav"
                    className="absolute inset-0 rounded-md bg-primary/10"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  />
                )}
                <Settings className="relative z-10" />
                <span className="relative z-10">Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={signOut}
                tooltip="Sign out"
                className="relative h-10 overflow-hidden text-sidebar-foreground/70 hover:bg-destructive/8 hover:text-destructive"
              >
                <LogOut className="relative z-10" />
                <span className="relative z-10">Sign out</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="hidden md:inline-flex" />
            <h1 className="truncate font-heading text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Toggle color theme"
                    onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
                  />
                }
              >
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              </TooltipTrigger>
              <TooltipContent>Toggle color theme</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Open user menu" />}
              >
                <Avatar>
                  <AvatarFallback>{initials(user?.name)}</AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="space-y-0.5 px-2 py-2">
                    <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "Account"}</p>
                    <p className="truncate text-xs font-normal text-muted-foreground">{user?.email ?? ""}</p>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={signOut}>
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="relative flex-1 p-4 pb-20 md:p-6 md:pb-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        {/* Backdrop for menu open */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 bg-background/45 backdrop-blur-md"
            />
          )}
        </AnimatePresence>

        {/* Floating Arc Menu Items Container */}
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 w-0 h-0 pointer-events-none">
          <AnimatePresence>
            {menuOpen &&
              secondaryNavigation.map((item, idx) => {
                const rad = (item.angle * Math.PI) / 180;
                const radius = item.arc === "inner" ? 85 : 140;
                const x = radius * Math.cos(rad);
                const y = radius * Math.sin(rad);
                const Icon = item.icon;
                const active = isActiveRoute(pathname, item.href);

                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      x: x,
                      y: -y,
                    }}
                    exit={{ opacity: 0, scale: 0, x: 0, y: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 25,
                      delay: idx * 0.02,
                    }}
                    className="absolute pointer-events-auto"
                    style={{
                      left: -22, // Centers 44px (w-11) button
                      bottom: -22, // Centers 44px (h-11) button
                    }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "relative flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105 active:scale-95",
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-primary/25"
                          : "bg-background/80 hover:bg-background border-border/40 text-foreground/80 hover:text-primary backdrop-blur-md"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className={cn(
                        "absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-popover/85 text-popover-foreground px-2 py-0.5 text-[9px] font-medium border border-border/30 shadow-xs pointer-events-none transition-all",
                        item.arc === "outer" ? "-top-6" : "-bottom-6"
                      )}>
                        {item.title}
                      </span>
                    </Link>
                  </motion.div>
                );
              })}
          </AnimatePresence>
        </div>

        {/* Bottom Nav Bar */}
        <div 
          style={{ height: "calc(4rem + env(safe-area-inset-bottom))", paddingBottom: "env(safe-area-inset-bottom)" }}
          className="relative flex items-center justify-between border-t bg-background/95 px-6 backdrop-blur-md"
        >
          {/* Primary Nav Slots */}
          <div className="flex w-full items-center justify-between">
            {primaryNavigation.map((item, idx) => {
              const Icon = item.icon;
              const active = isActiveRoute(pathname, item.href);
              const linkNode = (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-0.5 w-12 pt-1 pb-2 transition-colors text-muted-foreground hover:text-foreground",
                    active && "text-primary hover:text-primary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-[10px] font-medium">{item.title}</span>
                  {active && (
                    <motion.span
                      layoutId="mobile-active-dot"
                      className="absolute bottom-1 h-1 w-1 rounded-full bg-primary"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );

              if (idx === 1) {
                return (
                  <React.Fragment key={item.href}>
                    {linkNode}
                    {/* Slot 3: Center Button (More/Menu) */}
                    <div className="relative flex h-16 w-16 items-center justify-center">
                      <button
                        onClick={() => setMenuOpen(!menuOpen)}
                        className={cn(
                          "relative flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full border-4 border-background text-primary-foreground shadow-lg transition-all hover:scale-105 active:scale-95 focus:outline-hidden",
                          menuOpen
                            ? "bg-destructive text-destructive-foreground shadow-destructive/30 shadow-lg"
                            : "bg-primary text-primary-foreground shadow-primary/20 shadow-lg",
                          secondaryNavigation.some(secItem => isActiveRoute(pathname, secItem.href)) && !menuOpen && "ring-2 ring-primary/40 ring-offset-2"
                        )}
                        aria-label="Toggle navigation menu"
                      >
                        <motion.div
                          animate={{ rotate: menuOpen ? 135 : 0 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <Plus className="h-6 w-6" />
                        </motion.div>
                      </button>
                    </div>
                  </React.Fragment>
                );
              }

              return linkNode;
            })}
          </div>
        </div>
      </div>

      <LoaderOverlay show={loading || signingOut} label={signingOut ? "Signing out..." : "Loading your workspace..."} />
    </SidebarProvider>
  );
}
