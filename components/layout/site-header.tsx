import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export function SiteHeader({ variant = "solid" }: { variant?: "transparent" | "solid" }) {
  const solid = variant === "solid";

  return (
    <header
      className={
        solid
          ? "sticky top-0 z-30 border-b border-white/10 bg-[var(--color-navy-deep)]"
          : "absolute inset-x-0 top-0 z-20"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Logo tone={solid ? "light" : "dark"} />
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Primary">
          <Link href="/auth/sign-in">
            <Button
              variant="ghost"
              className={solid ? "text-white/90 hover:bg-white/10" : "text-[var(--color-ink)]"}
            >
              Sign in
            </Button>
          </Link>
          <Link href="/auth/sign-in">
            <Button className="min-h-11 px-5">Join</Button>
          </Link>
        </nav>
      </div>
    </header>
  );
}
