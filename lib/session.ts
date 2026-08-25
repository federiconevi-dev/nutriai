import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrCreateBalance } from "@/lib/credits";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function getDashboardContext() {
  const user = await requireUser();
  const [balance, dbUser] = await Promise.all([
    getOrCreateBalance(user.id),
    db.user.findUnique({ where: { id: user.id } }),
  ]);
  return { user, credits: balance.balance, dbUser };
}
