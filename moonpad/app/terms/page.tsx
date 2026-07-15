import { Callout, DocShell, Section } from "@/components/DocShell";

export const metadata = {
  title: "Terms of Use — The Coop",
};

export default function TermsPage() {
  return (
    <DocShell title="Terms of Use" updated="July 15, 2026">
      <Callout>
        Short version: The Coop is a non-custodial interface to open smart
        contracts. You keep your keys, you make your own decisions, and tokens
        launched here are highly speculative — you can lose everything you put
        in. Nothing here is financial advice.
      </Callout>

      <Section heading="1. Agreement">
        <p>
          These Terms of Use are an agreement between you and The Coop
          (&quot;we&quot;, &quot;us&quot;). They govern your access to and use
          of thecoop.fun, the Coop interface, and related features, content,
          and services (the &quot;Service&quot;). By accessing or using the
          Service, connecting a wallet, launching a token, or submitting a
          transaction through the interface, you confirm that you have read and
          accepted these Terms and the Privacy Policy. If you do not agree, do
          not use the Service.
        </p>
      </Section>

      <Section heading="2. Eligibility">
        <p>
          You must be at least 18 years old (or the age of majority in your
          jurisdiction, if higher), have the legal capacity to accept these
          Terms, and be permitted to use the Service under all laws that apply
          to you. You may not use the Service if you are subject to applicable
          sanctions, located in a jurisdiction where use is prohibited, or
          acting on behalf of a prohibited person or entity. You are solely
          responsible for determining whether your use is lawful.
        </p>
        <p>
          We may restrict or discontinue access to interface features where
          reasonably necessary for legal, security, operational, or risk
          reasons.
        </p>
      </Section>

      <Section heading="3. Non-custodial interface">
        <p>
          The Coop is a <strong>non-custodial software interface</strong> to
          autonomous smart contracts deployed on Robinhood Chain. We do not
          hold your assets or private keys, control your wallet, execute
          transactions on your behalf, guarantee settlement, or have any
          ability to reverse a blockchain transaction.
        </p>
        <p>
          We are not a bank, broker, exchange, custodian, investment adviser,
          fiduciary, money transmitter, or financial institution of any kind.
          Nothing available through the Service is financial, investment,
          legal, accounting, or tax advice.
        </p>
        <p>
          Every transaction is initiated and authorized through your own
          wallet. Smart contracts and the blockchain network — not us —
          determine whether and how a transaction executes.
        </p>
      </Section>

      <Section heading="4. How the protocol works">
        <p>
          Launching a token through the Service deploys a fixed-supply ERC20
          and deposits its entire supply into a Uniswap v3 liquidity position
          that is held by a locker contract with{" "}
          <strong>no withdrawal function</strong> — the liquidity is locked
          permanently, by construction, and cannot be removed by the creator,
          by us, or by anyone else. Trading happens on the Uniswap pool from
          the first block.
        </p>
        <p>
          The &quot;graduated&quot; badge is an informational milestone shown
          when the locked position has accumulated a threshold amount of ETH.
          Nothing changes on-chain at graduation, and no token is guaranteed to
          reach it.
        </p>
        <p>
          Token types differ in how the pool&apos;s swap fees are routed and
          whether the token carries a transfer tax:{" "}
          <strong>Super LP tokens apply a permanent 5% tax on buys</strong>,
          which is compounded into the locked liquidity position. Fee
          collection is permissionless: anyone (including automated systems we
          or others operate) may trigger it at any time, and no particular
          timing or frequency is guaranteed. Creator and platform fee shares
          are paid by the contracts, not by us.
        </p>
      </Section>

      <Section heading="5. Wallets and security">
        <p>
          We will never ask for your private key, recovery phrase, or wallet
          password. We cannot restore a wallet, recover assets, cancel token
          approvals, or assist with transactions signed through a compromised
          wallet.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Protect your wallet, private keys, recovery phrase, devices, and
            authentication methods.
          </li>
          <li>
            Review transaction details — token addresses, approvals, amounts,
            fees, slippage, and network — before signing.
          </li>
          <li>Use only wallets and devices you trust.</li>
          <li>
            You are responsible for all activity authorized through your
            wallet, including activity resulting from compromised credentials
            or devices.
          </li>
        </ul>
      </Section>

      <Section heading="6. Transactions and estimates">
        <p>
          Displayed quotes, prices, market capitalizations, fees, balances,
          progress indicators, simulations, and other figures are{" "}
          <strong>estimates</strong>. They may be delayed, incomplete, or
          different from final execution. USD values rely on third-party price
          feeds and are approximations.
        </p>
        <p>
          Blockchain transactions may be irreversible. Transactions may fail,
          remain pending, execute at an unexpected price, or be reordered due
          to network conditions, liquidity, slippage, smart contract behavior,
          or third-party systems. We do not guarantee that any transaction will
          be included, confirmed, or completed within any particular time.
        </p>
      </Section>

      <Section heading="7. Token launches and your content">
        <p>
          You are solely responsible for tokens you create or promote and for
          all names, symbols, descriptions, images, links, and other content
          you submit. You represent that you have all rights needed for
          submitted content and that it is accurate, lawful, and not
          misleading.
        </p>
        <p>
          Token creation does not mean we have reviewed, sponsored, endorsed,
          or approved the token or its creator. Anyone can launch a token with
          any name or symbol — <strong>always verify contract addresses</strong>{" "}
          before interacting.
        </p>
        <p>
          We may hide, restrict, or remove off-chain content from surfaces
          under our control when it violates these Terms, creates legal or
          security risk, or interferes with the Service. We cannot remove
          content or transactions recorded on a public blockchain or on
          distributed storage such as IPFS.
        </p>
      </Section>

      <Section heading="8. Risk disclosures">
        <p>
          You are responsible for your own research, risk assessment, and
          decisions. Use only assets you can afford to lose.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Tokens available through the Service may be volatile, experimental,
            illiquid, malicious, or worthless. Most speculative tokens lose
            value.
          </li>
          <li>
            Smart contracts — including ours — may contain defects,
            vulnerabilities, or unexpected behavior.{" "}
            <strong>
              Our contracts have not undergone a formal third-party audit.
            </strong>
          </li>
          <li>
            Wallets, RPC services, indexers, price feeds, storage providers,
            and networks may fail or become unavailable.
          </li>
          <li>
            Market data may be inaccurate, delayed, manipulated, or incomplete.
          </li>
          <li>
            Tokens and transactions may have legal, tax, accounting, or
            regulatory consequences in your jurisdiction.
          </li>
          <li>
            Network upgrades, forks, congestion, reorganizations, or validator
            conduct may affect transactions and assets.
          </li>
        </ul>
      </Section>

      <Section heading="9. Fees and taxes">
        <p>
          Transactions may incur network gas, Uniswap pool fees, token transfer
          taxes (Super LP buys), price impact, slippage, and third-party
          charges. Fee routing is defined by the smart contracts and described
          in the docs; displayed estimates may differ from final amounts.
        </p>
        <p>
          You are solely responsible for identifying, reporting, and paying any
          taxes, duties, and other governmental charges arising from your use
          of the Service.
        </p>
      </Section>

      <Section heading="10. Acceptable use">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Do not violate law, sanctions, intellectual property rights,
            privacy rights, or the rights of others.
          </li>
          <li>
            Do not publish fraudulent, deceptive, abusive, illegal, or
            malicious token metadata, links, or content.
          </li>
          <li>
            Do not interfere with the interface, bypass access controls,
            distribute malware, scrape abusively, or overload supporting
            infrastructure.
          </li>
          <li>
            Do not misrepresent affiliation with The Coop or use the Service to
            facilitate market manipulation, theft, or other unlawful conduct.
          </li>
          <li>
            Do not use the Service to launder funds, finance unlawful activity,
            or conceal proceeds of crime.
          </li>
        </ul>
        <p>
          We may investigate suspected misuse, restrict off-chain access or
          content, and cooperate with lawful requests.
        </p>
      </Section>

      <Section heading="11. Third-party services">
        <p>
          The Service connects to independent wallets, blockchain networks,
          smart contracts, RPC providers, indexers, explorers, data sources,
          storage systems, and websites. Their availability, accuracy,
          security, conduct, and terms are outside our control. A link or
          integration is not an endorsement. Your use of a third-party service
          is governed by its own terms and policies.
        </p>
      </Section>

      <Section heading="12. Intellectual property and submitted content">
        <p>
          The Coop interface, branding, design, and original content are
          protected by applicable intellectual property laws. These Terms grant
          you a limited, revocable, non-exclusive, non-transferable right to
          access and use the interface for lawful purposes.
        </p>
        <p>
          You retain any rights you hold in content you submit. You grant us a
          worldwide, non-exclusive, royalty-free license to host, store,
          reproduce, display, format, transmit, and moderate that content as
          reasonably necessary to operate, secure, and promote the Service.
          This license continues for content that remains on public blockchains,
          distributed storage, or backups. If you provide feedback or
          suggestions, we may use them without restriction or compensation.
        </p>
      </Section>

      <Section heading="13. Service availability">
        <p>
          We may add, modify, suspend, restrict, or discontinue any feature or
          the interface at any time, without notice. We do not guarantee
          continuous availability, compatibility with any wallet or network, or
          preservation of off-chain data.
        </p>
        <p>
          The smart contracts are deployed on a public, permissionless network:
          you remain able to interact with them directly without our interface,
          subject to those systems and your own technical ability.
        </p>
      </Section>

      <Section heading="14. No warranties">
        <p>
          To the fullest extent permitted by law, the Service is provided
          &quot;as is&quot; and &quot;as available&quot;, without warranties of
          any kind, express, implied, or statutory — including merchantability,
          fitness for a particular purpose, title, non-infringement, accuracy,
          availability, security, and uninterrupted operation. We do not
          warrant that tokens, content, data, smart contracts, transactions, or
          third-party services are accurate, legitimate, safe, complete, or
          free from defects.
        </p>
      </Section>

      <Section heading="15. Limitation of liability">
        <p>
          To the fullest extent permitted by law, we and our service providers
          will not be liable for indirect, incidental, special, consequential,
          exemplary, or punitive damages, lost profits, lost data, loss of
          assets, failed or delayed transactions, smart contract defects,
          wallet compromise, network events, price movement, market
          manipulation, or third-party conduct.
        </p>
        <p>
          To the fullest extent permitted by law, our total liability for
          claims arising from or relating to the Service will not exceed the
          greater of (a) the fees you paid directly to us for use of the
          interface during the twelve months before the event giving rise to
          the claim, or (b) one hundred United States dollars. Some
          jurisdictions do not allow certain exclusions or limitations; in
          those jurisdictions, liability is limited only to the extent
          permitted by law.
        </p>
      </Section>

      <Section heading="16. Indemnification">
        <p>
          To the fullest extent permitted by law, you agree to defend,
          indemnify, and hold harmless The Coop and its service providers from
          claims, losses, liabilities, damages, judgments, costs, and
          reasonable legal fees arising from your use of the Service, your
          submitted content, your violation of these Terms, or your violation
          of law or another person&apos;s rights.
        </p>
      </Section>

      <Section heading="17. Disputes">
        <p>
          Before starting a formal claim relating to the Service, you agree to
          contact us at contact@thecoop.fun with a reasonable description of
          the dispute, and both parties will attempt in good faith to resolve
          the matter informally. Nothing in this section limits rights that
          cannot be waived under applicable law. Governing law and forum
          requirements will be determined by the laws applicable to the
          operator and the dispute.
        </p>
      </Section>

      <Section heading="18. General">
        <p>
          If a provision of these Terms is found unenforceable, the remaining
          provisions continue in effect. A failure to enforce a provision is
          not a waiver. You may not assign your rights under these Terms
          without our consent; we may assign these Terms in connection with a
          reorganization or transfer of the Service. These Terms and the
          Privacy Policy are the entire agreement between you and us concerning
          the interface.
        </p>
      </Section>

      <Section heading="19. Changes and contact">
        <p>
          We may update these Terms as the interface, risks, or legal
          requirements change; the date above identifies the current version.
          Continued use after revised Terms become effective means you accept
          them for later activity. Questions:{" "}
          <span className="font-mono">contact@thecoop.fun</span>.
        </p>
      </Section>
    </DocShell>
  );
}
