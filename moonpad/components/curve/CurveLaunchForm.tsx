"use client";

import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { decodeEventLog, parseEther } from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";

import { coopLaunchpadV2Abi } from "@/lib/evm/abi/coopLaunchpadV2";
import { activeChain, launchpadAddress } from "@/lib/evm/chains";

type Flavor = 0 | 1 | 2; // 0 = Standard, 1 = LPGrow, 2 = SuperLP (contract enum)
const FLAVOR_KEYS = ["standard", "lpGrow", "superLp"] as const;

export function CurveLaunchForm() {
  const router = useRouter();
  const { isConnected, address: account } = useAccount();
  const { openConnectModal } = useConnectModal();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const chain = activeChain();

  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [twitter, setTwitter] = useState("");
  const [telegram, setTelegram] = useState("");
  const [flavor, setFlavor] = useState<Flavor>(0);
  const [devBuy, setDevBuy] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [step, setStep] = useState<"" | "pin" | "mine">("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { data: receipt, isLoading: confirming } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const wrongChain = isConnected && chainId !== chain.id;
  const devBuyWei = useMemo(() => {
    try {
      return parseEther(devBuy || "0");
    } catch {
      return 0n;
    }
  }, [devBuy]);

  // Once mined, pull the new token address out of the TokenLaunched log and go there.
  useEffect(() => {
    if (!receipt) return;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: coopLaunchpadV2Abi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "TokenLaunched") {
          const tokenAddr = (decoded.args as { token: string }).token;
          router.push(`/coin/${tokenAddr.toLowerCase()}`);
          return;
        }
      } catch {
        /* not our event */
      }
    }
  }, [receipt, router]);

  const onPickImage = (file: File | null) => {
    setImage(file);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: chain.id });
      return;
    }
    const cleanName = name.trim();
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanName || !cleanSymbol) {
      setError("Name and ticker are required.");
      return;
    }

    try {
      setStep("pin");
      const form = new FormData();
      form.set("name", cleanName);
      form.set("symbol", cleanSymbol);
      form.set("description", description.trim());
      form.set("website", website.trim());
      form.set("twitter", twitter.trim());
      form.set("telegram", telegram.trim());
      if (image) form.set("image", image);

      const res = await fetch("/api/curve/pin-metadata", { method: "POST", body: form });
      const pin = (await res.json()) as { ok: boolean; uri?: string; error?: string };
      if (!pin.ok) throw new Error(pin.error ?? "metadata pinning failed");
      const uri = pin.uri ?? "";

      // Mine a CREATE2 salt so the token address ends in …c00.
      setStep("mine");
      let salt: `0x${string}` = `0x${crypto
        .getRandomValues(new Uint8Array(32))
        .reduce((s, b) => s + b.toString(16).padStart(2, "0"), "")}` as `0x${string}`;
      try {
        const saltRes = await fetch("/api/curve/vanity-salt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: cleanName,
            symbol: cleanSymbol,
            metadataURI: uri,
            creator: account,
            flavor: FLAVOR_KEYS[flavor],
          }),
        });
        const mined = (await saltRes.json()) as { ok: boolean; salt?: `0x${string}` };
        if (mined.ok && mined.salt) salt = mined.salt;
      } catch {
        /* random salt fallback — launch still works, just without the suffix */
      }

      writeContract({
        abi: coopLaunchpadV2Abi,
        address: launchpadAddress(),
        functionName: "launchToken",
        args: [cleanName, cleanSymbol, uri, flavor, salt, 0n],
        value: devBuyWei,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "launch failed");
    } finally {
      setStep("");
    }
  };

  const busy = step !== "" || isPending || confirming;
  const label = !isConnected
    ? "Connect wallet"
    : wrongChain
      ? `Switch to ${chain.name}`
      : step === "pin"
        ? "Pinning metadata…"
        : step === "mine"
          ? "Mining …c00 address…"
          : isPending
            ? "Confirm in wallet…"
            : confirming
              ? "Launching…"
              : "Launch token 🚀";

  const inputCls =
    "w-full rounded-xl border border-coop-straw/50 bg-coop-canvas px-3 py-2.5 text-sm text-coop-ink outline-none transition focus:border-coop-yolk dark:border-coop-700 dark:bg-coop-950 dark:text-coop-shell";
  const labelCls =
    "mb-1 block text-xs font-bold uppercase tracking-wider text-coop-wood/70 dark:text-coop-shell/60";

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={submit} className="grid max-w-3xl gap-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Name</label>
              <input
                className={inputCls}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={64}
                placeholder="Golden Coin"
              />
            </div>
            <div>
              <label className={labelCls}>Ticker</label>
              <input
                className={`${inputCls} font-mono uppercase`}
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                maxLength={12}
                placeholder="GOLD"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Token image</label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-[124px] w-[124px] items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-coop-straw/60 bg-coop-surface-warm/40 text-3xl transition hover:border-coop-yolk dark:border-coop-700 dark:bg-coop-800/40"
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="preview" className="h-full w-full object-cover" />
              ) : (
                "+"
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickImage(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Description</label>
          <textarea
            className={`${inputCls} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            placeholder="What's this token about?"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelCls}>Website</label>
            <input className={inputCls} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className={labelCls}>X / Twitter</label>
            <input className={inputCls} value={twitter} onChange={(e) => setTwitter(e.target.value)} placeholder="https://x.com/…" />
          </div>
          <div>
            <label className={labelCls}>Telegram</label>
            <input className={inputCls} value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="https://t.me/…" />
          </div>
        </div>

        <div>
          <label className={labelCls}>Token type</label>
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  id: 0 as Flavor,
                  title: "Standard",
                  text: "0% fees — no token tax, ever",
                },
                {
                  id: 1 as Flavor,
                  title: "🌱 LP-Growing",
                  text: "0% fees — Uniswap pool fees auto-deepen the locked liquidity",
                },
                {
                  id: 2 as Flavor,
                  title: "🔒 Super LP",
                  text: "5% buy tax — 100% auto-compounds into liquidity locked forever",
                },
              ] as const
            ).map((card) => (
              <button
                key={card.id}
                type="button"
                onClick={() => setFlavor(card.id)}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  flavor === card.id
                    ? "border-coop-yolk bg-coop-yolk/10"
                    : "border-coop-straw/40 bg-coop-surface hover:border-coop-yolk/60 dark:border-coop-700 dark:bg-coop-900/60"
                }`}
              >
                <p className="font-display text-sm font-extrabold text-coop-ink dark:text-coop-shell">
                  {card.title}
                </p>
                <p className="mt-1 text-xs leading-snug text-coop-wood/75 dark:text-coop-shell/60">
                  {card.text}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Dev buy (optional)</label>
          <div className="flex items-center gap-3">
            <input
              className={`${inputCls} max-w-[160px] font-mono`}
              value={devBuy}
              onChange={(e) => setDevBuy(e.target.value.replace(",", "."))}
              inputMode="decimal"
              placeholder="0.0"
            />
            <span className="text-xs text-coop-wood/70 dark:text-coop-shell/55">
              ETH — buys the first tokens in the same transaction, before any sniper
              can.
            </span>
          </div>
        </div>

        {error || writeError ? (
          <p className="break-words text-xs leading-snug text-red-500">
            {error || writeError?.message.split("\n")[0].slice(0, 200)}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="w-fit rounded-xl bg-coop-ink px-6 py-3 text-sm font-extrabold text-white shadow-md transition hover:bg-coop-orange disabled:opacity-50 dark:bg-coop-yolk dark:text-coop-950 dark:hover:bg-white"
        >
          {label}
        </button>
        <p className="text-xs text-coop-wood/60 dark:text-coop-shell/50">
          Launching is free — you only pay gas{devBuyWei > 0n ? " plus your dev buy" : ""}.
          Your token&apos;s address ends in{" "}
          <code className="rounded bg-coop-surface-warm px-1 py-0.5 font-mono dark:bg-coop-800">
            …c00
          </code>
          , trades on Uniswap v3 from the very first block, and earns the graduated
          badge at 3.5 ETH in the pool. Liquidity is locked forever.
        </p>
      </form>

      {/* live preview */}
      <aside className="sticky top-20 hidden lg:block">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-coop-wood/60 dark:text-coop-shell/50">
          Live preview
        </p>
        <div className="rounded-2xl border border-coop-straw/40 bg-coop-surface p-4 shadow-sm dark:border-coop-700 dark:bg-coop-900/60">
          <div className="flex items-start gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-coop-yolk/20 font-display text-lg font-extrabold text-coop-wood dark:text-coop-yolk-soft">
                {(symbol || "?").slice(0, 3).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-display text-sm font-extrabold text-coop-ink dark:text-coop-shell">
                  {name || "Your token"}
                </p>
                {symbol ? (
                  <span className="shrink-0 rounded bg-coop-surface-warm px-1.5 py-0.5 font-mono text-[10px] font-bold text-coop-wood dark:bg-coop-800 dark:text-coop-shell/80">
                    {symbol.toUpperCase()}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-3 text-xs leading-snug text-coop-wood/70 dark:text-coop-shell/55">
                {description || "Your description shows up here."}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-coop-surface-warm dark:bg-coop-800">
              <div className="h-full w-[2%] rounded-full bg-gradient-to-r from-coop-yolk to-coop-orange" />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-coop-wood/60 dark:text-coop-shell/45">
              <span>bonding curve 0%</span>
              <span>0 / 3.5 ETH</span>
            </div>
          </div>
          {flavor === 1 ? (
            <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-coop-sky/10 px-2 py-0.5 text-[10px] font-bold text-coop-sky dark:bg-coop-sky/20">
              🌱 LP-Growing
            </span>
          ) : flavor === 2 ? (
            <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-coop-orange/10 px-2 py-0.5 text-[10px] font-bold text-coop-orange dark:bg-coop-orange/20">
              🔒 Super LP
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] leading-snug text-coop-wood/55 dark:text-coop-shell/45">
          This is how your token card will look on the board.
        </p>
      </aside>
    </div>
  );
}
