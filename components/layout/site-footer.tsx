import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="bg-[var(--color-navy-deep)] text-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <Logo tone="light" compact />
          <p className="mt-3 max-w-sm text-sm text-white/65">
            Connecting Rotaractors with verified Rotary-linked businesses for careers and growth.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70" aria-label="Footer">
          <Link href="/auth/sign-in" className="hover:text-white">
            Sign in
          </Link>
          <Link href="/auth/sign-in" className="hover:text-white">
            Join
          </Link>
          <Link href="/employer/sign-in" className="hover:text-white">
            For employers
          </Link>
          <Link href="/privacy" className="hover:text-white">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-white">
            Terms
          </Link>
        </nav>
        <p className="text-xs text-white/45">© {new Date().getFullYear()} RotaSambandh</p>
      </div>
    </footer>
  );
}
