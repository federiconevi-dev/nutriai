"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SettingsForm({ name, email, hasPassword }: { name: string; email: string; hasPassword: boolean }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(name);
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfileSave() {
    setSavingProfile(true);
    try {
      const res = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName }),
      });
      if (!res.ok) {
        toast.error("Could not update profile.");
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSave() {
    setSavingPassword(true);
    try {
      const res = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not update password.");
        return;
      }
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-6">
        <p className="font-medium">Profile</p>
        <div className="space-y-1.5">
          <Label>Full name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Email</Label>
          <Input value={email} disabled />
        </div>
        <Button variant="gradient" onClick={handleProfileSave} disabled={savingProfile}>
          {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </Card>

      {hasPassword && (
        <Card className="space-y-4 p-6">
          <p className="font-medium">Change password</p>
          <div className="space-y-1.5">
            <Label>Current password</Label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <Button
            variant="gradient"
            onClick={handlePasswordSave}
            disabled={savingPassword || !currentPassword || newPassword.length < 8}
          >
            {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
            Update password
          </Button>
        </Card>
      )}

      <Card className="space-y-3 p-6">
        <p className="font-medium">Branding</p>
        <p className="text-sm text-muted-foreground">
          This instance is configured as <span className="text-foreground">Videora AI</span>. To rename or re-brand the
          app, update <code className="rounded bg-secondary px-1.5 py-0.5 text-xs">lib/config.ts</code> — the name flows
          through the landing page, dashboard and emails automatically.
        </p>
      </Card>

      <Separator />

      <div className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        <div>
          <p className="text-sm font-medium text-destructive">Sign out everywhere</p>
          <p className="text-xs text-muted-foreground">You'll need to log in again on all devices.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
