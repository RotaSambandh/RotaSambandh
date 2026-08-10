"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { buttonClassName } from "@/components/ui/button";
import { Badge, Banner } from "@/components/ui";
import {
  applicationStatusLabel,
  applicationStatusVariant,
} from "@/lib/admin/status-badges";
import {
  subscribeCandidateApplicationsRtdb,
  type ApplicationReadModel,
} from "@/lib/dal/applications-rtdb";
import { cn } from "@/lib/utils";

export function JobApplyCta({
  jobId,
  open,
  className,
}: {
  jobId: string;
  open: boolean;
  className?: string;
}) {
  const { user } = useAuth();
  const [existing, setExisting] = useState<ApplicationReadModel | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user?.uid) {
      setExisting(null);
      setReady(true);
      return;
    }
    setReady(false);
    return subscribeCandidateApplicationsRtdb(user.uid, (list) => {
      setExisting(list.find((a) => a.jobId === jobId) ?? null);
      setReady(true);
    });
  }, [user?.uid, jobId]);

  if (!ready) {
    return (
      <div
        className={cn(
          "h-11 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface)]",
          className,
        )}
        aria-hidden
      />
    );
  }

  if (existing) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-[var(--color-ink)]">Applied</p>
          <Badge variant={applicationStatusVariant(existing.status)}>
            {applicationStatusLabel(existing.status)}
          </Badge>
        </div>
        <Link
          href="/candidate/applications"
          className={cn(buttonClassName("secondary"), "w-full")}
        >
          View application
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <Banner tone="warning" title="Applications closed" className={className}>
        The deadline for this opportunity has passed.
      </Banner>
    );
  }

  return (
    <Link
      href={`/candidate/apply/${jobId}`}
      className={cn(buttonClassName("primary"), "w-full", className)}
    >
      Apply now
    </Link>
  );
}
