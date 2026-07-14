import { Callout, DocShell, Section } from "@/components/DocShell";

export const metadata = {
  title: "Terms of Service — The Coop",
};

export default function TermsPage() {
  return (
    <DocShell title="Terms of Service" updated="July 14, 2026">
      <Callout>
        Short version: The Coop is a non-custodial interface to open smart
        contracts. You keep your keys, you make your own decisions, and tokens
        launched here are highly speculative — you can lose everything you put
        in. Nothing here is financial advice.
      </Callout>

      <Section heading="1. Acceptance of these terms">
        <p>
          These Terms of Service (&quot;Terms&quot;) govern your access to and
          use of The Coop website, interface, and related services
          (collectively, the &quot;Service&quot;). By accessing or using the
          Service, connecting a wallet, launching a token, or trading, you
          agree to be bound by these Terms. If you do not agree, do not use the
          Service.
        </p>
      </Section>

      <Section heading="2. Eligibility">
        <p>
          You must be at least 18 years old (or the age of majority in your
          jurisdiction, if higher) and have the legal capacity to enter into
          these Terms. You may not use the Service if you are located in, or a
          resident of, any jurisdiction where use of the Service is prohibited,
          or if you are subject to economic sanctions or listed on any
          restricted-party list. You are solely responsible for ensuring your
          use of the Service is lawful where you live.
        </p>
      </Section>

      <Section heading="3. What the Service is (and is not)">
        <p>
          The Service is a web interface to autonomous smart contracts deployed
          on Robinhood Chain: a token factory, bonding-curve trading contracts,
          and integrations with third-party protocols such as Uniswap. The
          Service is <strong>non-custodial</strong>: we never hold your funds,
          private keys, or tokens, and we cannot execute, reverse, or block
          transactions on your behalf.
        </p>
        <p>
          The smart contracts operate autonomously on a public blockchain.
          Token launches, trades, graduations, and fee flows are executed by
          code, not by us. The interface displays data indexed from the public
          blockchain and may be incomplete, delayed, or temporarily
          unavailable.
        </p>
        <p>
          We do not create, issue, endorse, sponsor, or vouch for any token
          launched through the Service. Tokens are created by independent
          third-party users. A token&apos;s appearance on the Service is not a
          recommendation or endorsement.
        </p>
      </Section>

      <Section heading="4. No investment advice">
        <p>
          Nothing on the Service constitutes investment, financial, legal, tax,
          or other professional advice. Market data, prices, charts, market
          capitalizations, and USD conversions are estimates provided for
          convenience and may be inaccurate. You are solely responsible for
          your decisions and for any taxes arising from your activity.
        </p>
      </Section>

      <Section heading="5. Fees">
        <p>
          The Service charges the fees described in the docs, including: a 1%
          fee on bonding-curve trades (split between the platform and the token
          creator) and a flat graduation fee. After graduation, tokens trade in
          a Uniswap v3 pool at the 1% fee tier; those pool fees accrue to the
          permanently locked liquidity position and are distributed by the
          locker contract (to the creator and the platform, and for LP-Growing
          tokens partially reinvested into the locked position). Parameters for
          already-graduated tokens are fixed on-chain; fee parameters for
          future launches may change. Network gas fees are separate and are
          never received by us.
        </p>
      </Section>

      <Section heading="6. Token launches and creator responsibilities">
        <p>
          If you launch a token, you are its creator and solely responsible for
          it: the name, ticker, imagery, description, links, and any community,
          promises, or promotion around it. You represent that your token and
          its content do not infringe any third-party rights, do not
          impersonate any person or brand, and are not part of any fraudulent
          or unlawful scheme.
        </p>
        <p>
          Token metadata and images are published to IPFS and the public
          blockchain and are permanent. We may remove or hide tokens, imagery,
          or metadata from the interface (without affecting the underlying
          blockchain) at our sole discretion, including for legal or safety
          reasons.
        </p>
      </Section>

      <Section heading="7. Prohibited use">
        <p>You agree not to use the Service to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>violate any law, regulation, or sanctions program;</li>
          <li>
            commit fraud, including rug pulls, misleading promotions, or
            impersonation of persons, projects, or brands;
          </li>
          <li>
            manipulate markets (including wash trading, spoofing, or
            coordinated pump-and-dump schemes);
          </li>
          <li>launder money or finance terrorism;</li>
          <li>
            interfere with the Service&apos;s operation, attempt to exploit the
            smart contracts, or access the Service through automated means that
            degrade it for others;
          </li>
          <li>infringe intellectual-property or publicity rights.</li>
        </ul>
        <p>
          We may restrict access to the interface for any wallet or user we
          reasonably believe violates these Terms.
        </p>
      </Section>

      <Section heading="8. Assumption of risk">
        <p>By using the Service you acknowledge and accept that:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Tokens launched here are extremely speculative.</strong>{" "}
            Most will lose most or all of their value. You may lose everything.
          </li>
          <li>
            <strong>Smart contracts can fail.</strong> The platform&apos;s
            contracts have not undergone a formal third-party security audit.
            Bugs, exploits, or unexpected behavior could cause irreversible
            loss.
          </li>
          <li>
            <strong>Blockchain transactions are final.</strong> Nobody —
            including us — can reverse, cancel, or refund them.
          </li>
          <li>
            <strong>Prices are volatile</strong> and liquidity may be thin.
            Slippage settings limit but do not eliminate execution risk.
          </li>
          <li>
            <strong>Post-graduation trading</strong> happens in a Uniswap v3
            pool with a 1% fee tier whose liquidity is locked in a contract
            with no withdrawal path; pool fee distribution depends on that
            contract operating as designed.
          </li>
          <li>
            <strong>Third-party dependencies</strong> — wallets, RPC providers,
            IPFS gateways, price feeds, Uniswap, and Robinhood Chain itself —
            are outside our control and may fail or change.
          </li>
          <li>
            <strong>Regulatory treatment of tokens is uncertain</strong> and
            may change in ways that adversely affect the Service or your
            tokens.
          </li>
        </ul>
      </Section>

      <Section heading="9. Intellectual property">
        <p>
          The Service&apos;s interface, branding, and content (excluding
          user-submitted token content and open-source components) are owned by
          us or our licensors. You may not copy or imitate the Service&apos;s
          branding in a way likely to confuse users. User-submitted token
          content remains the creator&apos;s responsibility; by submitting it
          you grant us a non-exclusive, worldwide, royalty-free license to
          display it in the interface.
        </p>
      </Section>

      <Section heading="10. Disclaimers">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE,
          AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
          UNINTERRUPTED, ERROR-FREE, OR SECURE, THAT DATA DISPLAYED IS
          ACCURATE, OR THAT THE SMART CONTRACTS ARE FREE OF DEFECTS.
        </p>
      </Section>

      <Section heading="11. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE AND OUR AFFILIATES,
          OFFICERS, EMPLOYEES, AND AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT,
          INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES,
          OR FOR ANY LOSS OF PROFITS, TOKENS, DATA, OR GOODWILL, ARISING FROM
          OR RELATED TO YOUR USE OF THE SERVICE. OUR AGGREGATE LIABILITY FOR
          ALL CLAIMS SHALL NOT EXCEED THE GREATER OF (A) THE PLATFORM FEES YOU
          PAID TO US THROUGH THE SERVICE IN THE 12 MONTHS PRECEDING THE CLAIM,
          OR (B) 100 USD.
        </p>
      </Section>

      <Section heading="12. Indemnification">
        <p>
          You agree to indemnify and hold us harmless from any claims, damages,
          and expenses (including reasonable legal fees) arising from your use
          of the Service, tokens you create, content you submit, or your
          violation of these Terms or applicable law.
        </p>
      </Section>

      <Section heading="13. Changes, suspension, and termination">
        <p>
          We may modify the interface, these Terms, or fee parameters for
          future launches at any time. Material changes to these Terms will be
          reflected by updating the date above; continued use after changes
          constitutes acceptance. We may suspend or discontinue the interface
          at any time — the smart contracts remain on-chain regardless, and
          claimable balances remain claimable directly from the contracts.
        </p>
      </Section>

      <Section heading="14. Governing law and disputes">
        <p>
          These Terms are governed by the laws of the operator&apos;s
          jurisdiction of establishment, without regard to conflict-of-law
          rules. Any dispute shall be resolved in the courts of that
          jurisdiction, unless mandatory law provides otherwise. You waive any
          right to participate in class actions to the extent permitted by law.
        </p>
      </Section>

      <Section heading="15. Contact">
        <p>
          Questions about these Terms can be raised through the community
          channels linked in the app.
        </p>
      </Section>
    </DocShell>
  );
}
