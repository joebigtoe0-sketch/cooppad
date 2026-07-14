"use client";

import { Transaction } from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { InitPresaleParams } from "@/lib/instructions";
import {
  INIT_DESCRIPTION_MAX_BYTES,
  INIT_SOCIAL_MAX_BYTES,
  INIT_WEBSITE_MAX_BYTES,
  ONCHAIN_RAISE_TARGET_LAMPORTS,
  PLATFORM_MAX_CONTRIBUTION_LAMPORTS,
  PLATFORM_MIN_CONTRIBUTION_LAMPORTS,
  PLATFORM_PRESALE_DURATION_SECONDS,
  parseSolAmountToNetLamports,
} from "@/lib/presaleConstants";
import { sendSignedTransaction } from "@/lib/sendTransaction";

import { TransactionToast, type ToastKind } from "./TransactionToast";

const field =
  "mt-1 w-full rounded-lg border border-coop-straw/50 bg-white px-3 py-2 text-sm text-coop-ink shadow-sm placeholder:text-coop-wood/40 focus:border-coop-sky focus:outline-none";

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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  /** Net SOL for optional `contribute` ix in the same tx as initialize (empty = skip). */
  const [initialBuySol, setInitialBuySol] = useState("");
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

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  function onCoverChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setCoverFile(null);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverPreview(null);
      return;
    }
    if (f.size > 1_500_000) {
      showToast("Image must be under 1.5MB (PNG, JPG, or WebP).", "error");
      e.target.value = "";
      return;
    }
    if (!/^image\/(png|jpeg|webp)$/i.test(f.type)) {
      showToast("Use PNG, JPG, or WebP.", "error");
      e.target.value = "";
      return;
    }
    setCoverFile(f);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverPreview(URL.createObjectURL(f));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!wallet.publicKey || !wallet.signTransaction) {
      showToast("Connect your wallet first.", "error");
      return;
    }

    const params: InitPresaleParams = {
      tokenName,
      tokenTicker,
      tokenUri: "",
      description,
      durationSeconds: PLATFORM_PRESALE_DURATION_SECONDS,
      maxContribution: PLATFORM_MAX_CONTRIBUTION_LAMPORTS,
      twitter,
      telegram,
      website,
    };

    setBusy(true);
    try {
      let tokenUriForInit: string | undefined;

      if (coverFile) {
        const fd = new FormData();
        fd.append("tokenName", tokenName.trim());
        fd.append("tokenTicker", tokenTicker.trim());
        fd.append("description", description.trim());
        fd.append("image", coverFile);
        const pinRes = await fetch("/api/presale/pin-metadata", {
          method: "POST",
          body: fd,
        });
        const pinData = (await pinRes.json()) as {
          ok?: boolean;
          reason?: string;
          metadataUrl?: string;
          error?: string;
        };
        if (!pinRes.ok || !pinData.ok || !pinData.metadataUrl) {
          throw new Error(
            pinData.error ??
              (pinData.reason === "pinata_not_configured"
                ? "Cover image requires PINATA_JWT on the server (see .env.example)."
                : "Could not pin token metadata for your cover image.")
          );
        }
        tokenUriForInit = pinData.metadataUrl;
      } else {
        const pinRes = await fetch("/api/presale/pin-metadata", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tokenName: tokenName.trim(),
            tokenTicker: tokenTicker.trim(),
            description: description.trim(),
          }),
        });
        const pinData = (await pinRes.json()) as {
          ok?: boolean;
          reason?: string;
          metadataUrl?: string;
          error?: string;
        };
        if (!pinRes.ok) {
          throw new Error(pinData.error ?? "Pin metadata failed");
        }
        if (pinData.ok && pinData.metadataUrl) {
          tokenUriForInit = pinData.metadataUrl;
        } else if (pinData.reason !== "pinata_not_configured") {
          throw new Error(pinData.error ?? "Pin metadata failed");
        }
      }

      const parsedNet = parseSolAmountToNetLamports(initialBuySol);
      if (parsedNet === null) {
        showToast("Invalid first-buy amount (use e.g. 0.1 or leave blank).", "error");
        return;
      }
      if (
        parsedNet > 0n &&
        parsedNet < PLATFORM_MIN_CONTRIBUTION_LAMPORTS
      ) {
        showToast("First buy must be at least 0.01 SOL net, or leave blank.", "error");
        return;
      }
      const maxFirstNet =
        PLATFORM_MAX_CONTRIBUTION_LAMPORTS < ONCHAIN_RAISE_TARGET_LAMPORTS
          ? PLATFORM_MAX_CONTRIBUTION_LAMPORTS
          : ONCHAIN_RAISE_TARGET_LAMPORTS;
      if (parsedNet > maxFirstNet) {
        showToast(
          `First buy net cannot exceed ${Number(maxFirstNet) / 1e9} SOL for this raise.`,
          "error"
        );
        return;
      }

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash("confirmed");

      const res = await fetch("/api/presale/prepare-initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creator: wallet.publicKey.toBase58(),
          blockhash,
          lastValidBlockHeight,
          tokenName: params.tokenName,
          tokenTicker: params.tokenTicker,
          description: params.description,
          durationSeconds: params.durationSeconds,
          maxContribution: params.maxContribution.toString(),
          twitter: params.twitter,
          telegram: params.telegram,
          website: params.website,
          ...(tokenUriForInit ? { tokenUri: tokenUriForInit } : {}),
          ...(parsedNet > 0n
            ? { initialContributionLamports: parsedNet.toString() }
            : {}),
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        mint?: string;
        transaction?: string;
        lastValidBlockHeight?: number;
      };

      if (
        !res.ok ||
        !data.transaction ||
        data.lastValidBlockHeight === undefined ||
        !data.mint
      ) {
        throw new Error(data.error ?? "Could not prepare egg transaction");
      }

      const tx = Transaction.from(Buffer.from(data.transaction, "base64"));
      const sig = await sendSignedTransaction(connection, wallet, tx, {
        preserveBlockhash: true,
        lastValidBlockHeight: data.lastValidBlockHeight,
      });
      showToast(`Egg laid! ${sig.slice(0, 16)}…`, "success");
      if (coverFile && !tokenUriForInit) {
        const fd = new FormData();
        fd.append("mint", data.mint);
        fd.append("file", coverFile);
        const up = await fetch("/api/presale/upload-image", {
          method: "POST",
          body: fd,
        });
        if (!up.ok) {
          const errBody = (await up.json().catch(() => ({}))) as {
            error?: string;
          };
          showToast(
            errBody.error ??
              "Egg is live, but the cover image could not be saved.",
            "error"
          );
        }
      }
      router.push(`/presale/${data.mint}`);
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
      className="mx-auto max-w-lg space-y-4 rounded-2xl border border-coop-straw/35 bg-coop-surface p-6 shadow-md shadow-coop-ink/5"
    >
      <h2 className="font-display text-lg font-extrabold text-coop-ink">
        Lay an egg
      </h2>
      <p className="text-xs text-coop-wood/80">
        Connect your wallet and submit. A new token mint is created for you in
        the background (you will not see a mint keypair). You pay the on-chain
        launch fee (1 SOL) plus rent.
      </p>

      <div className="bg-coop-surface-warm rounded-lg border border-dashed border-coop-straw/45 px-3 py-2 text-xs text-coop-wood/90">
        <p className="font-semibold text-coop-ink">Egg rules (fixed)</p>
        <ul className="mt-1 list-inside list-disc space-y-0.5">
          <li>Duration: 30 days</li>
          <li>
            Max credited per wallet: 2 SOL (a 1% platform fee is added on top
            when you join). On devnet the raise cap is 0.85 SOL, so your first
            buy cannot exceed that net.
          </li>
          <li>
            Mint address ends with <span className="font-mono">coop</span> — taken
            from a server-side pool (pre-mined with{" "}
            <span className="font-mono">scripts/mine-mint-pool.cjs</span>)
          </li>
          <li>
            Mint and freeze authority are revoked on creation — fixed supply,
            no one can mint more or freeze holders
          </li>
        </ul>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-medium text-coop-wood">Token name</label>
          <input
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            required
            maxLength={32}
            className={field}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-coop-wood">Ticker</label>
          <input
            value={tokenTicker}
            onChange={(e) => setTokenTicker(e.target.value)}
            required
            maxLength={10}
            className={field}
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-coop-wood">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={INIT_DESCRIPTION_MAX_BYTES}
          rows={3}
          className={field}
        />
      </div>

      <div>
        <label className="text-xs font-medium text-coop-wood">
          Token image (cover)
        </label>
        <p className="mt-0.5 text-[11px] leading-snug text-coop-wood/65">
          Optional PNG, JPG, or WebP (max 1.5MB). With a cover, the server must
          have <span className="font-mono">PINATA_JWT</span> set so the image and
          Metaplex JSON are pinned to IPFS before your egg transaction. Shown on
          the coop grid and presale page.
        </p>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={onCoverChange}
          className="mt-2 block w-full text-xs text-coop-wood file:mr-3 file:rounded-lg file:border file:border-coop-straw/50 file:bg-coop-surface-warm file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-coop-ink"
        />
        {coverPreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverPreview}
            alt=""
            className="mt-3 h-32 w-32 rounded-xl border border-coop-straw/40 object-cover shadow-sm"
          />
        ) : null}
      </div>

      <p className="text-[11px] text-coop-wood/60">
        Without Pinata, wallets use a short placeholder URI; with{" "}
        <span className="font-mono">PINATA_JWT</span>, name/symbol/description and
        optional cover are written to Metaplex metadata in the same transaction
        as the mint.
      </p>

      <div>
        <label className="text-xs font-medium text-coop-wood">
          Your first buy (optional)
        </label>
        <p className="mt-0.5 text-[11px] text-coop-wood/70">
          Net SOL credited to the raise in the <strong>same transaction</strong> as
          laying the egg (plus 1% platform fee on top). Leave blank to skip. Min{" "}
          0.01 SOL if set. Max{" "}
          {Number(
            PLATFORM_MAX_CONTRIBUTION_LAMPORTS < ONCHAIN_RAISE_TARGET_LAMPORTS
              ? PLATFORM_MAX_CONTRIBUTION_LAMPORTS
              : ONCHAIN_RAISE_TARGET_LAMPORTS
          ) / 1e9}{" "}
          SOL net on this deployment.
        </p>
        <input
          type="text"
          inputMode="decimal"
          placeholder="e.g. 0.25 (optional)"
          value={initialBuySol}
          onChange={(e) => setInitialBuySol(e.target.value)}
          className={field}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs font-medium text-coop-wood">Twitter</label>
          <input
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            maxLength={INIT_SOCIAL_MAX_BYTES}
            className={field}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-coop-wood">Telegram</label>
          <input
            value={telegram}
            onChange={(e) => setTelegram(e.target.value)}
            maxLength={INIT_SOCIAL_MAX_BYTES}
            className={field}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-coop-wood">Website</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            maxLength={INIT_WEBSITE_MAX_BYTES}
            className={field}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-coop-yolk py-3 text-sm font-semibold text-coop-ink shadow-sm hover:bg-coop-orange hover:text-white disabled:opacity-40"
      >
        {busy ? "Confirm in wallet…" : "Lay an egg"}
      </button>

      <TransactionToast
        message={toast.msg}
        kind={toast.kind}
        visible={toast.show}
      />
    </form>
  );
}
