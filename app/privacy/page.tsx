import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { DISPLAY_NAME } from "@/shared/constants";

export const metadata = {
  title: "Privacy Policy",
  description: `How ${DISPLAY_NAME} collects and uses personal data.`,
};

export default function PrivacyPage() {
  return (
    <main className="bg-white text-[var(--color-ink)]">
      <SiteHeader variant="solid" />
      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Last updated: August 2026</p>
        <div className="mt-8 space-y-6 font-serif text-base leading-relaxed text-[var(--color-muted)]">
          <p>
            RotaSambandh ({DISPLAY_NAME}) helps Rotaractors find opportunities with
            Rotary-linked businesses. This policy explains what we collect and why.
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            What we collect
          </h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Google account identity (name, email, photo) when you sign in</li>
            <li>Rotaract club and district, profile details, and phone number you provide</li>
            <li>Resumes and application answers you submit for a job</li>
            <li>Company profile data, including Rotary contact details for verification</li>
            <li>Optional push notification tokens if you enable alerts</li>
            <li>Basic product analytics (for example, application submitted) when configured</li>
          </ul>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            How we use it
          </h2>
          <p>
            We use this data to operate the career network: matching candidates with jobs,
            verifying businesses, moderating listings, and sending in-app (and optional push)
            notifications. Resume files are stored in private object storage and shared with
            employers only for applications they are authorized to review.
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Retention and deletion
          </h2>
          <p>
            Application contact details are stored on each application. Company soft-delete and
            purge flows remove company data under admin control. For account erasure or data
            requests, contact the platform operators via your district champion or the contact
            channel published on the site.
          </p>
          <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
            Processors
          </h2>
          <p>
            We use Google Firebase (Auth, Firestore, Realtime Database, Cloud Messaging),
            Netlify (hosting), and Cloudflare R2 (private resume storage). Google Analytics may
            run when a measurement ID is configured.
          </p>
          <p>
            See also our <Link href="/terms" className="text-[var(--color-accent-strong)] underline">Terms of Use</Link>.
          </p>
        </div>
      </article>
      <SiteFooter />
    </main>
  );
}
