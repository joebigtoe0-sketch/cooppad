/** Null-padded UTF-8 buffers for `initialize_presale` (matches on-chain `[u8; N]`). */
export function utf8PadFixed(s: string, byteLen: number): number[] {
  const enc = new TextEncoder().encode(s);
  if (enc.length > byteLen) {
    throw new Error(`Value exceeds ${byteLen} bytes when UTF-8 encoded`);
  }
  const out = new Array<number>(byteLen).fill(0);
  for (let i = 0; i < enc.length; i++) out[i] = enc[i]!;
  return out;
}
