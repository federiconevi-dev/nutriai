"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, Coins, Plus, LogOut, Settings, User as UserIcon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Topbar({
  name,
  email,
  image,
  credits,
  isAdmin,
  onMenuClick,
}: {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  credits: number;
  isAdmin?: boolean;
  onMenuClick: () => void;
}) {
  const router = useRouter();
  const initials = (name || email || "U").slice(0, 1).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-white/5 bg-background/80 px-4 backdrop-blur-lg sm:px-6">
      <button className="lg:hidden" onClick={onMenuClick} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1" />

      <Link
        href="/credits"
        className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:flex"
      >
        <Coins className="h-3.5 w-3.5 text-brand-400" />
        {credits.toLocaleString()} credits
      </Link>

      <Button size="sm" variant="gradient" asChild>
        <Link href="/create">
          <Plus className="h-4 w-4" /> Create video
        </Link>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="rounded-full ring-offset-background transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar>
              <AvatarImage src={image ?? undefined} alt={name ?? "User"} />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel className="font-normal">
            <p className="truncate text-sm font-medium text-foreground">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <UserIcon className="h-4 w-4" /> Account settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/credits">
              <Coins className="h-4 w-4" /> Billing & credits
            </Link>
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <ShieldCheck className="h-4 w-4" /> Admin panel
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive focus:text-destructive">
            <LogOut className="h-4 w-4" /> Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
