import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { getOrCreateBalance } from "@/lib/credits";
import type { Role, Plan } from "@/lib/types";

const googleEnabled = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash) return null;
        if (user.disabled) throw new Error("This account has been disabled.");

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role as Role,
          plan: user.plan as Plan,
        };
      },
    }),
    ...(googleEnabled
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = await db.user.findUnique({ where: { email: user.email } });
        if (existing?.disabled) return false;
        if (existing) {
          await getOrCreateBalance(existing.id);
        } else {
          // New OAuth users start on the FREE plan with signup bonus credits.
          const created = await db.user.upsert({
            where: { email: user.email },
            update: {},
            create: { email: user.email, name: user.name, image: user.image },
          });
          await getOrCreateBalance(created.id);
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role ?? "USER";
        token.plan = (user as any).plan ?? "FREE";
      }
      if (trigger === "update" || !token.role) {
        const dbUser = await db.user.findUnique({ where: { id: token.id as string } });
        if (dbUser) {
          token.role = dbUser.role as Role;
          token.plan = dbUser.plan as Plan;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.plan = token.plan;
      }
      return session;
    },
  },
};
