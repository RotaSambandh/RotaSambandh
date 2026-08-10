import Link from "next/link";
import { ArrowRight, BadgeCheck, Briefcase, ShieldCheck, Users } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { Button } from "@/components/ui/button";
import { DISPLAY_NAME, TAGLINE } from "@/shared/constants";

export default function HomePage() {
  return (
    <main className="bg-white text-[var(--color-ink)]">
      <SiteHeader variant="solid" />

      <section className="relative overflow-hidden bg-[var(--color-navy-deep)] text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          aria-hidden
          style={{
            background:
              "radial-gradient(ellipse 70% 60% at 85% 20%, rgba(37,99,235,0.35), transparent 55%), radial-gradient(ellipse 50% 40% at 10% 90%, rgba(5,150,105,0.12), transparent 50%)",
          }}
        />
        <div className="relative mx-auto flex min-h-[78vh] max-w-6xl flex-col justify-center px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/mark-circle.webp"
              alt=""
              width={72}
              height={72}
              className="rounded-full"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">
                {DISPLAY_NAME}
              </p>
              <h1 className="mt-2 max-w-3xl font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Rota<span className="text-[var(--color-accent-soft)]">Sambandh</span>
              </h1>
            </div>
          </div>
          <p className="mt-5 max-w-xl font-serif text-lg leading-relaxed text-white/75 sm:text-xl">
            {TAGLINE}
          </p>
          <p className="mt-3 max-w-lg font-serif text-base leading-relaxed text-white/60">
            A career network for Rotaractors. Sign in to browse verified roles from Rotary-linked
            businesses. Built for the Rotaract community, not an open public job board.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/auth/sign-in">
              <Button className="min-h-12 min-w-44 px-6 text-base">Join the network</Button>
            </Link>
            <Link href="/auth/sign-in?next=%2Fjobs">
              <Button
                variant="secondary"
                className="min-h-12 min-w-44 border-white/25 bg-transparent px-6 text-base text-white hover:bg-white/10"
              >
                Sign in to browse jobs
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          What this network is for
        </h2>
        <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-[var(--color-muted)]">
          Help Rotaractors find jobs, internships, freelance work, and apprenticeships with verified
          Rotarian and Rotaractor businesses across the Rotary ecosystem.
        </p>
      </section>

      <section className="border-y border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          <div>
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-accent-soft)] text-[var(--color-accent-strong)]">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              For Rotaractors
            </h2>
            <p className="mt-3 font-serif text-base leading-relaxed text-[var(--color-muted)]">
              Set up your profile, find roles from verified businesses, apply with a resume for that
              role, and track status updates in one place.
            </p>
            <Link
              href="/auth/sign-in"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent-strong)] hover:underline"
            >
              Create candidate account <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div>
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-md bg-[var(--color-success-soft)] text-[var(--color-success)]">
              <Briefcase className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              For businesses
            </h2>
            <p className="mt-3 font-serif text-base leading-relaxed text-[var(--color-muted)]">
              Create a company profile, draft openings anytime, then go public after company
              verification and job review. Review applicants under each role.
            </p>
            <Link
              href="/employer/sign-in"
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-accent-strong)] hover:underline"
            >
              Employer portal <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-24">
        <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Built on trust
        </h2>
        <p className="mt-3 max-w-2xl font-serif text-[var(--color-muted)]">
          Jobs are available after sign-in. Businesses receive a verified badge only after admin
          review, not by self-declaration.
        </p>
        <ul className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Verified businesses",
              body: "Rotary affiliation is checked by an admin before the trust badge appears.",
            },
            {
              icon: BadgeCheck,
              title: "Built for Rotaract",
              body: "Sign-up asks for your club and district. Listings stay behind sign-in for the network.",
            },
            {
              icon: Briefcase,
              title: "Clear hiring path",
              body: "Employers manage applicants under each job: shortlist, interview, then select.",
            },
          ].map((item) => (
            <li key={item.title} className="border-t border-[var(--color-border)] pt-6">
              <item.icon className="h-5 w-5 text-[var(--color-success)]" aria-hidden />
              <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 font-serif text-sm leading-relaxed text-[var(--color-muted)]">{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center lg:px-8">
          <div>
            <h2 className="font-display text-2xl font-semibold sm:text-3xl">
              Start here
            </h2>
            <p className="mt-2 font-serif text-[var(--color-muted)]">
              Create an account, then sign in to browse opportunities.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/sign-in">
              <Button className="min-h-11 min-w-36">Join</Button>
            </Link>
            <Link href="/auth/sign-in">
              <Button variant="secondary" className="min-h-11 min-w-36">
                Sign in
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
