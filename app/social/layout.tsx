import type { Metadata } from "next";
import { requireUser } from "@/lib/session";
import { SocialHeader, SocialTabs } from "@/components/social/nav";

export const metadata: Metadata = { title: "Estudio Social" };

/** Standalone shell for the social hub — separate from the video app. */
export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return (
    <div className="min-h-screen">
      <SocialHeader name={user.name ?? user.email ?? "U"} />
      <main className="relative mx-auto max-w-[1400px] px-4 pb-16 pt-4 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[80%] -translate-x-1/2 rounded-full bg-brand-600/10 blur-3xl" />
        <SocialTabs />
        {children}
      </main>
    </div>
  );
}
