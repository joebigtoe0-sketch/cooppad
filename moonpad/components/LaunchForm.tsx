"use client";

import { Keypair, Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { InitPresaleParams } from "@/lib/instructions";
import {
  PLATFORM_MAX_CONTRIBUTION_LAMPORTS,
  PLATFORM_PRESALE_DURATION_SECONDS,
  placeholderTokenUri,
} from "@/lib/presaleConstants";
import { sendSignedTransaction } from "@/lib/sendTransaction";

import { TransactionToast, type ToastKind } from "./TransactionToast";

export function LaunchForm() {
  const router = useRouter();
  const { connection } = useConnection();
  const wallet = useWallet();

  const [tokenName, setTokenName] = useState("");
  const [tokenTicker, setTokenTicker] = useState("");
  const [description, setDescription] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    kind: ToastKind;
    show: boolean;
  }>({ msg: "", kind: "info", show: false });

  const showToast = (msg: string, kind: ToastKind) => {
    setToast({ msg, kind, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), 6000);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction) {
      showToast("Connect your wallet first.", "error");
      return;
    }

    const mintKp = Keypair.generate();
    const tokenUri = placeholderTokenUri(mintKp.publicKey.toBase58());

    const params: InitPresaleParams = {
      tokenName,
      tokenTicker,
      tokenUri,
      description,
      durationSeconds: PLATFORM_PRESALE_DURATION_SECONDS,
      maxContribution: PLATFORM_MAX_CONTRIBUTION_LAMPORTS,
      twitter,
      telegram,
      website,
    };

    setBusy(true);
    try {
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const res = await fetch("/api/presale/prepare-initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: wallet.publicKey.toBase58(),
          mint: mintKp.publicKey.toBase58(),
          blockhash,
          lastValidBlockHeight,
          tokenName: params.tokenName,
          tokenTicker: params.tokenTicker,
          tokenUri: params.tokenUri,
          description: params.description,
          durationSeconds: params.durationSeconds,
          maxContribution: params.maxContribution.toString(),
          twitter: params.twitter,
          telegram: params.telegram,
          website: params.website,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        transaction?: string;
        lastValidBlockHeight?: number;
      };

      if (!res.ok || !data.transaction || data.lastValidBlockHeight === undefined) {
        throw new Error(data.error ?? "Could not prepare presale transaction");
      }

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const sig = await sendSignedTransaction(connection, wallet, tx, {
        additionalSigners: [mintKp],
        preserveBlockhash: true,
        lastValidBlockHeight: data.lastValidBlockHeight,
      });
      showToast(`Presale created! ${sig.slice(0, 16)}…`, "success");
      router.push(`/presale/${mintKp.publicKey.toBase58()}`);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Initialize failed",
        "error"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="mx-auto max-w-lg space-y-4 rounded-2xl border border-zinc-800 bg-moon-900/40 p-6"
    >
      <h2 className="text-lg font-semibold text-white">Create presale</h2>
      <p className="text-xs text-zinc-500">
        Connect your wallet and submit. A new token mint is created for you in
        the background (you will not see a mint keypair). You pay the on-chain
        launch fee (1 SOL) plus rent.
      </p>

      <div className="rounded-lg border border-zinc-700/80 bg-moon-950/50 px-3 py-2 text-xs text-zinc-400">
        <p className="font-medium text-zinc-300">Presale rules (fixed)</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Duration: 30 days</li>
          <li>Max contribution per wallet: 2 SOL (net caps apply on-chain)</li>
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-zinc-400">Token name</label>
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            required
            maxLength={32}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-moon-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Ticker</label>
          <input
            value={tokenTicker}
            onChange={(e) => setTokenTicker(e.target.value)}
            required
            maxLength={10}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-moon-950 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-zinc-400">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={256}
          rows={3}
          className="mt-1 w-full rounded-lg border border-zinc-700 bg-moon-950 px-3 py-2 text-sm text-white"
        />
      </div>

      <p className="text-[11px] text-zinc-600">
        Token metadata URI is set to a temporary placeholder per mint until image
        upload and IPFS metadata are enabled.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-zinc-400">Twitter</label>
          <input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-moon-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Telegram</label>
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-moon-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Website</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={100}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-moon-950 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-violet-600 py-3 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-40"
      >
        {busy ? "Confirm in wallet…" : "Create presale"}
      </button>

      <TransactionToast
        message={toast.msg}
        kind={toast.kind}
        visible={toast.show}
      />
    </form>
  );
}
