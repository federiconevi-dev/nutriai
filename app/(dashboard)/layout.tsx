import { getDashboardContext } from "@/lib/session";
import { DashboardShell } from "@/components/dashboard/shell";
import { isDemoMode } from "@/lib/providers/video";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, credits } = await getDashboardContext();

  return (
    <DashboardShell
      user={{ name: user.name, email: user.email, image: user.image }}
      credits={credits}
      isAdmin={user.role === "ADMIN"}
      isDemoMode={isDemoMode()}
    >
      {children}
    </DashboardShell>
  );
}
