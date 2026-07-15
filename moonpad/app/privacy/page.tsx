import { Callout, DocShell, Section } from "@/components/DocShell";

export const metadata = {
  title: "Privacy Policy — The Coop",
};

export default function PrivacyPage() {
  return (
    <DocShell title="Privacy Policy" updated="July 15, 2026">
      <Callout>
        Short version: no accounts, no passwords, no ad trackers, and we never
        sell data. We see your wallet address because the blockchain is public,
        we store the token info you choose to publish, and we keep a few
        preferences in your own browser. Everything you put on-chain or on IPFS
        is public and permanent — nobody, including us, can delete it.
      </Callout>

      <Section heading="1. About this policy">
        <p>
          This Privacy Policy explains how The Coop (&quot;we&quot;,
          &quot;us&quot;) collects, uses, discloses, and protects information
          when you visit thecoop.fun, connect a wallet, launch or trade a
          token, contact us, or otherwise interact with the Coop interface (the
          &quot;Service&quot;). The Service is <strong>non-custodial</strong>:
          we do not control your wallet, hold your private keys or assets, or
          make blockchain transactions for you. Contact:{" "}
          <span className="font-mono">contact@thecoop.fun</span>.
        </p>
      </Section>

      <Section heading="2. Information we collect">
        <p>
          What we collect depends on how you use the interface. A wallet
          address or blockchain transaction can be personal information when it
          can be associated with an identifiable person.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Wallet and blockchain information</strong> — public wallet
            addresses, transaction hashes, token balances, smart contract
            interactions, and other public on-chain data.
          </li>
          <li>
            <strong>Content you submit</strong> — token names, symbols,
            descriptions, images, and social links.
          </li>
          <li>
            <strong>Communications</strong> — your email address and message
            contents if you contact us.
          </li>
          <li>
            <strong>Device and network information</strong> — IP address,
            browser and device type, requested pages, request timing, and
            security or diagnostic events collected by our hosting
            infrastructure.
          </li>
          <li>
            <strong>Local preferences</strong> stored in your own browser —
            theme, slippage settings, and wallet session state. These stay on
            your device.
          </li>
        </ul>
      </Section>

      <Section heading="3. Sources">
        <p>
          We receive information directly from you, automatically from your
          browser, from public blockchain networks, and from service providers
          such as wallet connectors, RPC providers, block explorers, IPFS
          gateways, and market data services.
        </p>
      </Section>

      <Section heading="4. How we use information">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Provide, maintain, and improve token discovery, launch, trading,
            analytics, and portfolio functionality.
          </li>
          <li>
            Connect wallets, prepare transaction requests, and display public
            on-chain activity.
          </li>
          <li>
            Process submitted content and moderate malicious links, spam,
            fraud, and prohibited activity.
          </li>
          <li>Respond to questions and support requests.</li>
          <li>
            Monitor reliability, diagnose failures, and protect the Service and
            its users from security threats and misuse.
          </li>
          <li>Comply with legal obligations and enforce the Terms of Use.</li>
        </ul>
        <p>
          Where applicable law requires a legal basis, we process information
          as necessary to provide the services you request, for legitimate
          interests such as operating and securing the interface, with your
          consent where requested, and to comply with legal obligations.
        </p>
      </Section>

      <Section heading="5. Blockchain information is permanent">
        <p>
          Public blockchain networks are transparent by design. Transactions,
          wallet addresses, token activity, and smart contract events may be
          permanently available through Robinhood Chain, nodes, explorers,
          indexers, and other independent services. Token metadata and images
          are stored on IPFS, a public distributed storage network.
        </p>
        <p>
          We cannot edit, hide, reverse, or delete information recorded on a
          public blockchain or on IPFS. Disconnecting your wallet or making a
          privacy request does not remove prior on-chain activity. Avoid
          including personal information in token names, descriptions, images,
          or links.
        </p>
      </Section>

      <Section heading="6. How we disclose information">
        <p>
          <strong>We do not sell personal information</strong> and we do not
          use it for targeted advertising. We may disclose information to
          vendors and infrastructure providers that support hosting, content
          delivery, security, wallet connectivity, blockchain access, indexing,
          storage, and market data — currently including Railway (hosting and
          database), Reown/WalletConnect (wallet connectivity), Pinata and IPFS
          gateways (token metadata), Robinhood Chain RPC services, Blockscout
          (block explorer), and CoinGecko (ETH price data). They process
          information under their own terms or on our behalf.
        </p>
        <p>
          We may also disclose information when required by law, to protect
          users or legal rights, to investigate abuse or security incidents, in
          connection with a business reorganization, or with your consent.
          Anything you publish on-chain or to public surfaces of the Service is
          visible to anyone.
        </p>
      </Section>

      <Section heading="7. Browser storage">
        <p>
          The Service and its wallet/infrastructure providers may use local
          storage and similar browser technologies to remember preferences,
          maintain wallet sessions, protect the interface, and measure
          performance. You can clear browser storage at any time; some settings
          and features may reset or stop working.
        </p>
      </Section>

      <Section heading="8. Retention">
        <p>
          We retain off-chain information only as long as reasonably necessary
          to provide the Service, resolve disputes, protect security, and
          comply with law. Indexed token and trade records remain available
          while the relevant product surface operates. Public blockchain and
          IPFS records persist indefinitely and are outside our control.
        </p>
      </Section>

      <Section heading="9. Security">
        <p>
          We use reasonable administrative and technical safeguards for systems
          under our control. No internet service, wallet, smart contract, or
          network can be guaranteed completely secure.{" "}
          <strong>
            Never send us your private key, recovery phrase, or wallet
            credentials
          </strong>{" "}
          — we will never ask for them. If you believe your interaction with
          the Service has created a security risk, contact{" "}
          <span className="font-mono">contact@thecoop.fun</span>.
        </p>
      </Section>

      <Section heading="10. International processing">
        <p>
          We and our service providers may process information in countries
          other than where you live, which may have different data protection
          laws. Where required, appropriate safeguards are used for
          international transfers.
        </p>
      </Section>

      <Section heading="11. Your rights and choices">
        <p>
          To make a privacy request, email{" "}
          <span className="font-mono">contact@thecoop.fun</span> with a
          description of your request and the wallet or email address needed to
          locate the relevant records. We may need to verify your identity or
          authority. We will not discriminate against you for exercising a
          privacy right; rights may be limited where an exception applies, and
          we cannot alter public blockchain records.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Browse public areas of the interface without connecting a wallet.
          </li>
          <li>
            Disconnect your wallet and clear local browser storage at any time.
          </li>
          <li>
            Depending on where you live, request access to, correction of,
            deletion of, or a copy of personal information held off-chain, and
            object to or restrict certain processing.
          </li>
          <li>
            Appeal a decision or complain to a data protection authority where
            applicable.
          </li>
        </ul>
        <p>
          United States state law disclosures: we do not sell personal
          information, do not share it for cross-context behavioral
          advertising, and do not knowingly use sensitive personal information
          for purposes requiring a right to limit.
        </p>
      </Section>

      <Section heading="12. Children">
        <p>
          The Service is not directed to children, and we do not knowingly
          collect personal information from anyone under 18. If you believe a
          child has provided personal information, contact{" "}
          <span className="font-mono">contact@thecoop.fun</span>.
        </p>
      </Section>

      <Section heading="13. Changes and contact">
        <p>
          We may update this policy as the interface, infrastructure, or legal
          requirements change; the date above identifies the current version.
          Material changes may be communicated through the interface. Questions
          and privacy requests:{" "}
          <span className="font-mono">contact@thecoop.fun</span>.
        </p>
      </Section>
    </DocShell>
  );
}
