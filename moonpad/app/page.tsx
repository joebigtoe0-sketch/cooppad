"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PublicKey } from "@solana/web3.js";

export default function HomePage() {
  const router = useRouter();
  const [mint, setMint] = useState("");
  const [err, setErr] = useState("");

  function goToPresale() {
    setErr("");
    try {
      const pk = new PublicKey(mint.trim());
      router.push(`/presale/${pk.toBase58()}`);
    } catch {
      setErr("Invalid mint address");
    }
  }

  return (
    <div className="space-y-12">
      <section className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
          Launch & join{" "}
          <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Solana presales
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-400">
          On-chain raise, withdrawals, claims, and refunds. Full-text listing and
          IPFS metadata come in a later pass — for now open any presale by mint
          or create a new one.
        </p>
        <div className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
          <input
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            placeholder="Presale mint (base58)"
            className="flex-1 rounded-lg border border-zinc-700 bg-moon-900 px-4 py-3 font-mono text-sm text-white outline-none focus:border-violet-500"
          />
          <button
            type="button"
            onClick={goToPresale}
            className="rounded-lg bg-violet-600 px-6 py-3 text-sm font-medium text-white hover:bg-violet-500"
          >
            Open
          </button>
        </div>
        {err ? <p className="mt-2 text-sm text-red-400">{err}</p> : null}
        <Link
          href="/launch"
          className="mt-6 inline-block text-sm text-violet-400 hover:text-violet-300"
        >
          Create a new presale →
        </Link>
      </section>
    </div>
  );
}
