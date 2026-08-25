import { requireUser } from "@/lib/session";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="h-screen overflow-hidden bg-background">{children}</div>;
}
