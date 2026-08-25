"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, CheckCircle2, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: string;
  plan: string;
  disabled: boolean;
  credits: number;
  createdAt: string;
}

export function AdminUsersTable({ users: initialUsers, currentUserId }: { users: User[]; currentUserId: string }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [creditTarget, setCreditTarget] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState("100");

  async function toggleDisabled(user: User) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ disabled: !user.disabled }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not update user.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, disabled: !u.disabled } : u)));
    toast.success(user.disabled ? "User enabled" : "User disabled");
  }

  async function changePlan(user: User, plan: string) {
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    if (!res.ok) {
      toast.error("Could not change plan.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, plan } : u)));
    toast.success("Plan updated");
  }

  async function handleAddCredits() {
    if (!creditTarget) return;
    const amount = Number(creditAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount.");
      return;
    }
    const res = await fetch(`/api/admin/users/${creditTarget.id}/credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Could not add credits.");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === creditTarget.id ? { ...u, credits: data.balance.balance } : u)));
    setCreditTarget(null);
    toast.success(`Added ${amount} credits`);
  }

  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="p-4 font-medium">User</th>
            <th className="p-4 font-medium">Plan</th>
            <th className="p-4 font-medium">Credits</th>
            <th className="p-4 font-medium">Status</th>
            <th className="p-4 font-medium">Joined</th>
            <th className="p-4 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-border/50 last:border-0">
              <td className="p-4">
                <p className="font-medium">{user.name || "—"}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </td>
              <td className="p-4">
                <Select value={user.plan} onValueChange={(v) => changePlan(user, v)}>
                  <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="CREATOR">Creator</SelectItem>
                    <SelectItem value="PRO">Pro</SelectItem>
                  </SelectContent>
                </Select>
              </td>
              <td className="p-4">{user.credits.toLocaleString()}</td>
              <td className="p-4">
                <Badge variant={user.disabled ? "destructive" : "success"}>{user.disabled ? "Disabled" : "Active"}</Badge>
              </td>
              <td className="p-4 text-xs text-muted-foreground">{formatDate(user.createdAt)}</td>
              <td className="p-4">
                <div className="flex justify-end gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => setCreditTarget(user)}>
                    <Coins className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={user.id === currentUserId}
                    onClick={() => toggleDisabled(user)}
                  >
                    {user.disabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog open={!!creditTarget} onOpenChange={(v) => !v && setCreditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add credits to {creditTarget?.email}</DialogTitle>
          </DialogHeader>
          <Input type="number" min={1} value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditTarget(null)}>Cancel</Button>
            <Button variant="gradient" onClick={handleAddCredits}>Add credits</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
