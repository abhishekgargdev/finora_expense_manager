import DashboardShell from "@/components/dashboard/dashboard-shell";

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
