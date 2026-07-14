import { NextResponse } from "next/server";

import { INIT_DESCRIPTION_MAX_BYTES, INIT_TOKEN_URI_MAX_BYTES } from "@/lib/presaleConstants";

export const runtime = "nodejs";

function gatewayBase(): string {
  const g = process.env.PINATA_GATEWAY?.trim();
  if (g) return g.replace(/\/$/, "");
  return "https://gateway.pinata.cloud";
}

function ipfsToUrl(cid: string): string {
  return `${gatewayBase()}/ipfs/${cid}`;
}

type PinResponse = { IpfsHash?: string; ipfsHash?: string };

function utf8ByteLen(s: string): number {
  return new TextEncoder().encode(s).length;
}

async function pinFileToPinata(jwt: string, file: File): Promise<string> {
  const form = new FormData();
  const buf = await file.arrayBuffer();
  const blob = new Blob([buf], {
    type: file.type || "application/octet-stream",
  });
  form.append("file", blob, file.name || "image.png");

  const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Pinata pinFile failed ${res.status}: ${t.slice(0, 240)}`);
  }
  const j = (await res.json()) as PinResponse;
  const hash = j.IpfsHash ?? j.ipfsHash;
  if (!hash) throw new Error("Pinata pinFile: missing IpfsHash");
  return hash;
}

async function pinJsonToPinata(
  jwt: string,
  content: Record<string, string>,
  name: string
): Promise<string> {
  const res = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: content,
      pinataMetadata: { name },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Pinata pinJSON failed ${res.status}: ${t.slice(0, 240)}`);
  }
  const j = (await res.json()) as PinResponse;
  const hash = j.IpfsHash ?? j.ipfsHash;
  if (!hash) throw new Error("Pinata pinJSON: missing IpfsHash");
  return hash;
}

export async function POST(req: Request) {
  const jwt = process.env.PINATA_JWT?.trim();
  if (!jwt) {
    return NextResponse.json(
      { ok: false, reason: "pinata_not_configured" },
      { status: 200 }
    );
  }

  try {
    const ct = req.headers.get("content-type") || "";
    let tokenName: string;
    let tokenTicker: string;
    let description: string;
    let imageFile: File | null = null;

    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      tokenName = String(form.get("tokenName") ?? "").trim();
      tokenTicker = String(form.get("tokenTicker") ?? "").trim();
      description = String(form.get("description") ?? "").trim();
      const f = form.get("image");
      if (f && typeof f === "object" && "arrayBuffer" in f) {
        imageFile = f as File;
      }
    } else {
      const body = (await req.json()) as {
        tokenName?: string;
        tokenTicker?: string;
        description?: string;
      };
      tokenName = String(body.tokenName ?? "").trim();
      tokenTicker = String(body.tokenTicker ?? "").trim();
      description = String(body.description ?? "").trim();
    }

    if (!tokenName || !tokenTicker) {
      return NextResponse.json(
        { error: "tokenName and tokenTicker are required" },
        { status: 400 }
      );
    }

    if (utf8ByteLen(tokenName) > 32 || utf8ByteLen(tokenTicker) > 10) {
      return NextResponse.json(
        { error: "tokenName (max 32 UTF-8 bytes) or tokenTicker (max 10) too long" },
        { status: 400 }
      );
    }

    if (utf8ByteLen(description) > INIT_DESCRIPTION_MAX_BYTES) {
      return NextResponse.json(
        { error: `description exceeds ${INIT_DESCRIPTION_MAX_BYTES} UTF-8 bytes` },
        { status: 400 }
      );
    }

    let imageUrl: string;
    if (imageFile && imageFile.size > 0) {
      if (imageFile.size > 1_500_000) {
        return NextResponse.json(
          { error: "Image must be under 1.5MB" },
          { status: 400 }
        );
      }
      const imageCid = await pinFileToPinata(jwt, imageFile);
      imageUrl = ipfsToUrl(imageCid);
    } else {
      imageUrl =
        process.env.PINATA_DEFAULT_TOKEN_IMAGE_URL?.trim() ||
        "https://placehold.co/512x512/png?text=Moonpad";
    }

    const metaCid = await pinJsonToPinata(
      jwt,
      {
        name: tokenName,
        symbol: tokenTicker,
        description,
        image: imageUrl,
      },
      `${tokenTicker}-metadata`
    );
    const metadataUrl = ipfsToUrl(metaCid);
    if (utf8ByteLen(metadataUrl) > INIT_TOKEN_URI_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Resolved metadata URL exceeds ${INIT_TOKEN_URI_MAX_BYTES} UTF-8 bytes; set a shorter PINATA_GATEWAY.`,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true, metadataUrl, imageUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Pin metadata failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
