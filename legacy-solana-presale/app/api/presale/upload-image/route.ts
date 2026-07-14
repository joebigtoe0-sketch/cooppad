import { NextResponse } from "next/server";

import { savePresaleCover } from "@/lib/server/presaleImageStore";

export const runtime = "nodejs";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(req: Request) {
  try {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data" },
        { status: 400 }
      );
    }
    const form = await req.formData();
    const mint = String(form.get("mint") ?? "").trim();
    const file = form.get("file");
    if (!mint || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: "mint and file are required" },
        { status: 400 }
      );
    }
    const mime = (file as File).type || "application/octet-stream";
    if (!ALLOWED.has(mime)) {
      return NextResponse.json(
        { error: "Only PNG, JPEG, or WebP allowed" },
        { status: 400 }
      );
    }
    const buf = Buffer.from(await file.arrayBuffer());
    await savePresaleCover(mint, buf, mime);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
