import { db } from "@/lib/db";
import type { CreditReason } from "@/lib/types";

export class InsufficientCreditsError extends Error {
  constructor() {
    super("Insufficient credits");
    this.name = "InsufficientCreditsError";
  }
}

export async function getOrCreateBalance(userId: string) {
  const existing = await db.creditBalance.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.creditBalance.create({ data: { userId, balance: 100 } });
}

/**
 * Atomically deducts credits, never allowing the balance to go negative.
 * Throws InsufficientCreditsError if the user doesn't have enough.
 */
export async function deductCredits(userId: string, amount: number, reason: CreditReason, note?: string) {
  return db.$transaction(async (tx) => {
    const balance = await tx.creditBalance.upsert({
      where: { userId },
      create: { userId, balance: 100 },
      update: {},
    });
    if (balance.balance < amount) {
      throw new InsufficientCreditsError();
    }
    const updated = await tx.creditBalance.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    });
    await tx.creditTransaction.create({
      data: { userId, amount: -amount, reason, note },
    });
    return updated;
  });
}

export async function addCredits(userId: string, amount: number, reason: CreditReason, note?: string) {
  return db.$transaction(async (tx) => {
    const updated = await tx.creditBalance.upsert({
      where: { userId },
      create: { userId, balance: 100 + amount },
      update: { balance: { increment: amount } },
    });
    await tx.creditTransaction.create({
      data: { userId, amount, reason, note },
    });
    return updated;
  });
}

export async function refundCredits(userId: string, amount: number, note?: string) {
  return addCredits(userId, amount, "REFUND", note);
}
