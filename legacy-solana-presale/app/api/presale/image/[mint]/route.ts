import { NextResponse } from "next/server";

import { readPresaleCover } from "@/lib/server/presaleImageStore";
import { resolveImageUrlFromPresaleTokenUri } from "@/lib/server/resolveMetadataImageUrl";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: { mint: string } }
) {
  const decodedMint = decodeURIComponent(params.mint);
  const img = await readPresaleCover(decodedMint);
  if (img) {
    return new NextResponse(new Uint8Array(img.buffer), {
      status: 200,
      headers: {
        "Content-Type": img.contentType,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  }

  const remote = await resolveImageUrlFromPresaleTokenUri(decodedMint);
  if (remote) {
    return NextResponse.redirect(remote, {
      status: 302,
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    });
  }

  return new NextResponse(null, { status: 404 });
}
