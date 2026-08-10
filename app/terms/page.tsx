import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DISPLAY_NAME } from "@/shared/constants";

export const metadata = {
  title: "Terms of Use",
  description: `Terms for using ${DISPLAY_NAME}.`,
};

export default function TermsPage() {
  return (
    <main className="bg-white text-[var(--color-ink)]">
      <SiteHeader variant="solid" />
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Terms of Use
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Last updated: August 2026</p>
        <div className="mt-8 space-y-6 font-serif text-base leading-relaxed text-[var(--color-muted)]">
          <p>
            By using RotaSambandh you agree to these terms. The service is a trusted career network
            for the Rotaract community, not an open public job board.
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Accounts
          </h2>
          <p>
            Sign-in uses Google only. You must provide accurate Rotaract affiliation and contact
            details. Platform staff may suspend accounts that abuse the network, post misleading
            listings, or violate Rotary community standards.
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Employers
          </h2>
          <p>
            You may draft jobs anytime. Public listings require staff verification of your business
            and review of each job. Verification is performed by platform admins — not by
            self-declaration.
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Candidates
          </h2>
          <p>
            Applications include a resume file (PDF/DOCX, size-limited) and contact details you
            confirm at submit. Portfolio and work samples should be shared as links, not as large
            file uploads.
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Content and liability
          </h2>
          <p>
            Job posts and company profiles are provided by employers. RotaSambandh moderates for
            trust but does not guarantee employment outcomes. Do not upload unlawful, infringing,
            or harmful content.
          </p>
          <p>
            See our <Link href="/privacy" className="text-[var(--color-accent-strong)] underline">Privacy Policy</Link> for
            how personal data is handled.
          </p>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
