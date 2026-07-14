import { Callout, DocShell, Section } from "@/components/DocShell";

export const metadata = {
  title: "Privacy Policy — The Coop",
};

export default function PrivacyPage() {
  return (
    <DocShell title="Privacy Policy" updated="July 14, 2026">
      <Callout>
        Short version: no accounts, no passwords, no analytics trackers. We see
        your wallet address because the blockchain is public, we store the
        token info you choose to publish, and we keep a few preferences in your
        own browser. Everything you put on-chain or on IPFS is public and
        permanent.
      </Callout>

      <Section heading="1. Who we are">
        <p>
          This policy describes how The Coop (&quot;we&quot;, &quot;us&quot;)
          handles information when you use our website and interface (the
          &quot;Service&quot;). The Service is a non-custodial interface to
          smart contracts on Robinhood Chain — we have no user accounts and
          never hold your keys or funds.
        </p>
      </Section>

      <Section heading="2. Information you provide">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Token launch content:</strong> the name, ticker,
            description, image, and links you submit when launching a token.
            This content is pinned to IPFS and referenced on the public
            blockchain — it is public and effectively permanent (see section
            5).
          </li>
          <li>
            <strong>Communications:</strong> anything you send us through
            community channels.
          </li>
        </ul>
      </Section>

      <Section heading="3. Information collected automatically">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Public blockchain data:</strong> wallet addresses,
            transactions, balances, and smart-contract events. We index this
            data from the public chain to power token pages, charts, holder
            lists, and portfolios. We did not create this data and cannot alter
            it.
          </li>
          <li>
            <strong>Basic server logs:</strong> IP addresses and request
            metadata, used only for operating, securing, and rate-limiting the
            Service.
          </li>
          <li>
            <strong>Browser storage:</strong> we store preferences (such as
            display currency, slippage setting, and theme) in your
            browser&apos;s local storage. These stay on your device and are not
            transmitted to us.
          </li>
        </ul>
        <p>
          We do not use analytics software, advertising trackers, or tracking
          cookies, and we do not build behavioral profiles. If this ever
          changes, this policy will be updated first.
        </p>
      </Section>

      <Section heading="4. How we use information">
        <ul className="list-disc space-y-1 pl-5">
          <li>to operate the Service: token pages, charts, feeds, portfolios;</li>
          <li>to secure the Service and prevent abuse;</li>
          <li>to display the token content creators choose to publish;</li>
          <li>to comply with legal obligations.</li>
        </ul>
        <p>We do not sell your information.</p>
      </Section>

      <Section heading="5. Blockchain and IPFS are permanent">
        <p>
          Anything written to a public blockchain — your wallet address, your
          trades, tokens you create — is public, replicated worldwide, and
          cannot be modified or deleted by us or anyone else. Token images and
          metadata are stored on IPFS, a public peer-to-peer network, where
          content can persist indefinitely and be served by parties other than
          us. Do not include personal information in token names, descriptions,
          or images.
        </p>
      </Section>

      <Section heading="6. Third-party services">
        <p>
          The Service integrates third parties that receive only what is
          technically necessary:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Wallet providers</strong> (e.g. MetaMask, WalletConnect):
            handle your keys and connection; governed by their own policies.
          </li>
          <li>
            <strong>RPC / blockchain infrastructure:</strong> your wallet and
            our server communicate with Robinhood Chain RPC endpoints to read
            and broadcast transactions.
          </li>
          <li>
            <strong>Pinata (IPFS):</strong> stores token images and metadata
            you submit at launch.
          </li>
          <li>
            <strong>Price data (CoinGecko):</strong> our server fetches the
            ETH/USD rate; your browser does not contact them.
          </li>
        </ul>
      </Section>

      <Section heading="7. Data retention">
        <p>
          Server logs are kept only as long as needed for security and
          operations. Indexed blockchain data mirrors the public chain and is
          retained while the Service operates. Blockchain and IPFS data are
          outside anyone&apos;s ability to delete.
        </p>
      </Section>

      <Section heading="8. Security">
        <p>
          We apply reasonable technical measures to protect our systems. No
          method of transmission or storage is completely secure, and we cannot
          guarantee absolute security. Your keys and wallet security are your
          responsibility — we will never ask for your seed phrase.
        </p>
      </Section>

      <Section heading="9. Your rights">
        <p>
          Depending on your jurisdiction (e.g. GDPR in the EU, CCPA in
          California), you may have rights to access, correct, or delete
          personal information we hold, or to object to certain processing.
          Contact us via the community channels to exercise them. Note that we
          cannot modify or erase data recorded on public blockchains or pinned
          to IPFS by design of those systems, and we typically hold little or
          no personal information beyond what is already public on-chain.
        </p>
      </Section>

      <Section heading="10. Children">
        <p>
          The Service is not directed at anyone under 18, and we do not
          knowingly collect information from children.
        </p>
      </Section>

      <Section heading="11. Changes to this policy">
        <p>
          We may update this policy from time to time. Material changes will be
          reflected by updating the date above. Continued use of the Service
          after changes constitutes acceptance.
        </p>
      </Section>
    </DocShell>
  );
}
