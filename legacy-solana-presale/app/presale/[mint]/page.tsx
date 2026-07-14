import { PresalePageClient } from "./PresalePageClient";

export default function PresalePage({
  params,
}: {
  params: { mint: string };
}) {
  return <PresalePageClient mint={params.mint} />;
}
