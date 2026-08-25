"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function DashboardShell({
  user,
  credits,
  isAdmin,
  isDemoMode,
  children,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null };
  credits: number;
  isAdmin?: boolean;
  isDemoMode?: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={isAdmin} isDemoMode={isDemoMode} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          name={user.name}
          email={user.email}
          image={user.image}
          credits={credits}
          isAdmin={isAdmin}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
