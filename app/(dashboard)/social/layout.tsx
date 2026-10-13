import { SocialTabs } from "@/components/social/nav";

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto max-w-[1400px]">
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-72 w-[80%] -translate-x-1/2 rounded-full bg-brand-600/10 blur-3xl" />
      <SocialTabs />
      {children}
    </div>
  );
}
