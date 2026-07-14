"use client";

import { useMemo, type ComponentType } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";

import "@solana/wallet-adapter-react-ui/styles.css";

const Conn = ConnectionProvider as ComponentType<{
  children: React.ReactNode;
  endpoint: string;
}>;
const Wall = WalletProvider as ComponentType<{
  children: React.ReactNode;
  wallets: unknown[];
  autoConnect?: boolean;
}>;
const Modal = WalletModalProvider as ComponentType<{
  children: React.ReactNode;
}>;

export function SolanaWalletProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const endpoint =
    process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <Conn endpoint={endpoint}>
      <Wall wallets={wallets} autoConnect>
        <Modal>{children}</Modal>
      </Wall>
    </Conn>
  );
}
