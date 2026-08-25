import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { APP_CONFIG } from "@/lib/config";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: `${APP_CONFIG.name} — ${APP_CONFIG.tagline}`,
  description: APP_CONFIG.description,
  metadataBase: new URL(APP_CONFIG.url),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={cn(inter.variable, "min-h-screen font-sans antialiased")}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
