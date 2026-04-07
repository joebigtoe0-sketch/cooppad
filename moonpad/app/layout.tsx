import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";

import { AppHeader } from "@/components/AppHeader";
import { SolanaWalletProvider } from "@/components/WalletProvider";

import "./globals.css";

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "MoonPad — Solana presales",
  description: "Create and join token presales on Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <SolanaWalletProvider>
          <AppHeader />
          <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
