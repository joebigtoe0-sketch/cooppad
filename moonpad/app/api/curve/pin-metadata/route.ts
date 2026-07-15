import { randomBytes } from "crypto";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://thecoop.fun";

/**
 * Pins the token's image + metadata JSON to IPFS (Pinata) for an EVM curve launch.
 * Returns a canonical ipfs:// URI to store on-chain; the indexer and UI resolve
 * it through the configured gateway.
 */

type PinResponse = { IpfsHash?: string; ipfsHash?: string };

async function pinFile(jwt: string, file: File): Promise<string> {
  const form = new FormData();
  const buf = await file.arrayBuffer();
  form.append(
    "file",
    new Blob([buf], { type: file.type || "application/octet-stream" }),
    file.name || "image.png"
  );
  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Pinata pinFile failed ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  const j = (await res.json()) as PinResponse;
  const hash = j.IpfsHash ?? j.ipfsHash;
  if (!hash) throw new Error("Pinata pinFile: missing IpfsHash");
  return hash;
}

async function pinJson(
  jwt: string,
  content: Record<string, string>,
  name: string
): Promise<string> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ pinataContent: content, pinataMetadata: { name } }),
  });
  if (!res.ok) {
    throw new Error(`Pinata pinJSON failed ${res.status}: ${(await res.text()).slice(0, 240)}`);
  }
  const j = (await res.json()) as PinResponse;
  const hash = j.IpfsHash ?? j.ipfsHash;
  if (!hash) throw new Error("Pinata pinJSON: missing IpfsHash");
  return hash;
}

export async function POST(req: Request) {
  try {
    const jwt = process.env.PINATA_JWT?.trim();
    const form = await req.formData();

    const text = (key: string, max = 500) =>
      String(form.get(key) ?? "").trim().slice(0, max);

    const name = text("name", 64);
    const symbol = text("symbol", 16);
    if (!name || !symbol) {
      return NextResponse.json(
        { ok: false, error: "name and symbol are required" },
        { status: 400 }
      );
    }

    if (!jwt) {
      // Local dev without Pinata: still return a URI so launches work end-to-end.
      return NextResponse.json({ ok: true, uri: "", pinned: false });
    }

    let imageUri = "";
    const image = form.get("image");
    if (image instanceof File && image.size > 0) {
      if (image.size > 4 * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: "image too large (max 4MB)" },
          { status: 400 }
        );
      }
      imageUri = `ipfs://${await pinFile(jwt, image)}`;
    } else if (process.env.PINATA_DEFAULT_TOKEN_IMAGE_URL) {
      imageUri = process.env.PINATA_DEFAULT_TOKEN_IMAGE_URL;
    }

    // Tokens launched without a website get a permanent /l/<id> short link
    // baked into the metadata — external terminals (Axiom, GMGN, DEXScreener)
    // read links from this JSON, not from our API. The coin-page URL can't go
    // here directly: the token's CREATE2 address hashes this very JSON's CID
    // (metadataURI is a constructor arg), so the address doesn't exist yet.
    // /l/<id> resolves to /coin/<address> once the token is indexed.
    const website = text("website", 200) || `${SITE_URL}/l/${randomBytes(6).toString("hex")}`;

    const metadata: Record<string, string> = {
      name,
      symbol,
      description: text("description", 1000),
      image: imageUri,
      website,
      twitter: text("twitter", 200),
      telegram: text("telegram", 200),
    };

    const cid = await pinJson(jwt, metadata, `coop-token-${symbol}`);
    return NextResponse.json({ ok: true, uri: `ipfs://${cid}`, pinned: true });
  } catch (err) {
    console.error("[api/curve/pin-metadata]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "pin failed" },
      { status: 500 }
    );
  }
}
