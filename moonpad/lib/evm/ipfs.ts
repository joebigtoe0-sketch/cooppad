/** Resolve ipfs:// URIs through a public gateway for the browser. */
export function ipfsToHttp(uri: string): string {
  if (!uri) return "";
  if (!uri.startsWith("ipfs://")) return uri;
  const gateway =
    process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim().replace(/\/$/, "") ??
    "https://gateway.pinata.cloud";
  return `${gateway}/ipfs/${uri.slice("ipfs://".length)}`;
}
