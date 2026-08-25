import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const user = await requireUser();
  const dbUser = await db.user.findUnique({ where: { id: user.id } });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account details and security.</p>
      </div>
      <SettingsForm
        name={dbUser?.name ?? ""}
        email={dbUser?.email ?? ""}
        hasPassword={!!dbUser?.passwordHash}
      />
    </div>
  );
}
