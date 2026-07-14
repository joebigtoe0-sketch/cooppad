import Link from "next/link";

/** Shared layout + typography for docs and legal pages. */

export function DocShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <article className="max-w-3xl pb-12">
      <h1 className="font-display text-2xl font-extrabold text-coop-ink dark:text-coop-shell">
        {title}
      </h1>
      {updated ? (
        <p className="mt-1 text-xs text-coop-wood/60 dark:text-coop-shell/50">
          Last updated: {updated}
        </p>
      ) : null}
      <div className="mt-6 space-y-8">{children}</div>
      <p className="mt-10 border-t border-coop-straw/30 pt-4 text-xs text-coop-wood/60 dark:border-coop-700 dark:text-coop-shell/50">
        Questions? Reach us via the community channels, or see the{" "}
        <Link href="/docs" className="underline hover:text-coop-orange">
          docs
        </Link>
        ,{" "}
        <Link href="/terms" className="underline hover:text-coop-orange">
          terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-coop-orange">
          privacy policy
        </Link>
        .
      </p>
    </article>
  );
}

export function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-display text-base font-extrabold text-coop-ink dark:text-coop-shell">
        {heading}
      </h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-coop-wood/90 dark:text-coop-shell/75">
        {children}
      </div>
    </section>
  );
}

export function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-coop-yolk/50 bg-coop-yolk/10 px-4 py-3 text-sm leading-relaxed text-coop-ink dark:text-coop-shell">
      {children}
    </div>
  );
}
