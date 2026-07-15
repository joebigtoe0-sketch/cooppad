import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono, Montserrat } from "next/font/google";

import { CoopShell } from "@/components/CoopShell";
import { CurrencyProvider } from "@/components/curve/CurrencyProvider";
import { EvmProvider } from "@/components/EvmProvider";

import "./globals.css";

const fontSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

const fontDisplay = Montserrat({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--font-coop-display",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://thecoop.fun"),
  title: "The Coop — token launchpad on Robinhood Chain",
  description:
    "Launch a token straight into a locked Uniswap v3 pool on Robinhood Chain. Free launches, liquidity locked forever. thecoop.fun",
  openGraph: {
    title: "The Coop — token launchpad on Robinhood Chain",
    description:
      "Launch a token straight into a locked Uniswap v3 pool on Robinhood Chain. Free launches, liquidity locked forever.",
    url: "https://thecoop.fun",
    siteName: "The Coop",
    images: [{ url: "/logo.png" }],
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${fontSans.variable} ${fontMono.variable} ${fontDisplay.variable}`}
    >
      <body className="min-h-screen font-sans antialiased text-coop-ink">
        <EvmProvider>
          <CurrencyProvider>
            <CoopShell>{children}</CoopShell>
          </CurrencyProvider>
        </EvmProvider>
      </body>
    </html>
  );
}
