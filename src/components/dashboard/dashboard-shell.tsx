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
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

const navigation = [
  { title: "Dashboard", href: "/dashboard", icon: Home },
  { title: "Income", href: "/income", icon: TrendingUp },
  { title: "Expenses", href: "/expenses", icon: TrendingDown },
  { title: "Investments", href: "/investments", icon: PiggyBank },
  { title: "Lending", href: "/lending", icon: Handshake },
  { title: "Credit Cards", href: "/credit-cards", icon: CreditCard },
  { title: "Bank Accounts", href: "/bank-accounts", icon: Landmark },
  { title: "Import / Export", href: "/import-export", icon: Upload },
];

const routeTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/income": "Income",
  "/expenses": "Expenses",
  "/investments": "Investments",
  "/lending": "Lending",
  "/credit-cards": "Credit Cards",
  "/bank-accounts": "Bank Accounts",
  "/import-export": "Import / Export",
  "/settings": "Settings",
};

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
}

function initials(name?: string | null) {
  return name
    ?.split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "U";
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useUser();
  const { resolvedTheme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = React.useState(false);
  const title = routeTitles[pathname] ?? "Finance Tracker";

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
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden font-heading font-semibold text-sidebar-foreground">
            <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-sm font-bold text-primary-foreground">F</span>
            <span className="truncate group-data-[collapsible=icon]:hidden">Finora</span>
          </Link>
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
                          active && "bg-primary/10 font-medium text-primary hover:bg-primary/10 hover:text-primary",
                        )}
                      >
                        {active && <motion.span layoutId="active-nav" className="absolute inset-0 rounded-md bg-primary/10" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
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
                className={cn("relative h-10 overflow-hidden text-sidebar-foreground/70 hover:bg-primary/8 hover:text-primary", isActiveRoute(pathname, "/settings") && "bg-primary/10 font-medium text-primary")}
              >
                {isActiveRoute(pathname, "/settings") && <motion.span layoutId="active-nav" className="absolute inset-0 rounded-md bg-primary/10" transition={{ type: "spring", stiffness: 420, damping: 32 }} />}
                <Settings className="relative z-10" />
                <span className="relative z-10">Settings</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="md:hidden" />
            <SidebarTrigger className="hidden md:inline-flex" />
            <h1 className="truncate font-heading text-lg font-semibold">{title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Toggle color theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")} />}>
                {resolvedTheme === "dark" ? <Sun /> : <Moon />}
              </TooltipTrigger>
              <TooltipContent>Toggle color theme</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Open user menu" />}>
                <Avatar><AvatarFallback>{initials(user?.name)}</AvatarFallback></Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="space-y-0.5 px-2 py-2">
                  <p className="truncate text-sm font-medium text-foreground">{user?.name ?? "Account"}</p>
                  <p className="truncate text-xs font-normal text-muted-foreground">{user?.email ?? ""}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={signOut}><LogOut />Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div className="relative flex-1 p-4 md:p-6">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: "easeOut" }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </div>
      </SidebarInset>
      <LoaderOverlay show={loading || signingOut} label={signingOut ? "Signing out..." : "Loading your workspace..."} />
    </SidebarProvider>
  );
}
