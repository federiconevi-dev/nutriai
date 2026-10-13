import { cn } from "@/lib/utils";
import { NETWORK_META, type Network } from "@/lib/social/types";

type IconProps = { className?: string };

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5 2.6 2.6 0 0 1-2.59-2.6 2.6 2.6 0 0 1 3.4-2.47V9.68a5.68 5.68 0 0 0-.81-.06A5.69 5.69 0 0 0 4.17 15.3 5.69 5.69 0 0 0 9.86 21a5.69 5.69 0 0 0 5.69-5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.25-1.48Z" />
    </svg>
  );
}

export function YouTubeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M21.58 7.19a2.5 2.5 0 0 0-1.76-1.77C18.26 5 12 5 12 5s-6.26 0-7.82.42a2.5 2.5 0 0 0-1.76 1.77C2 8.75 2 12 2 12s0 3.25.42 4.81a2.5 2.5 0 0 0 1.76 1.77C5.74 19 12 19 12 19s6.26 0 7.82-.42a2.5 2.5 0 0 0 1.76-1.77C22 15.25 22 12 22 12s0-3.25-.42-4.81ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  );
}

export function NetworkIcon({ network, className }: { network: Network } & IconProps) {
  if (network === "instagram") return <InstagramIcon className={className} />;
  if (network === "tiktok") return <TikTokIcon className={className} />;
  return <YouTubeIcon className={className} />;
}

/** Round chip with the network icon in its identity color. */
export function NetworkBadge({ network, size = "md", className }: { network: Network; size?: "sm" | "md" } & IconProps) {
  return (
    <span
      title={NETWORK_META[network].label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full text-white shadow-md ring-2 ring-black/30",
        size === "sm" ? "h-5 w-5 [&_svg]:h-3 [&_svg]:w-3" : "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5",
        className
      )}
      style={{ backgroundColor: NETWORK_META[network].color }}
    >
      <NetworkIcon network={network} />
      <span className="sr-only">{NETWORK_META[network].label}</span>
    </span>
  );
}
