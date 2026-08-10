"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { createReport } from "@/lib/dal/admin";
import { Button } from "@/components/ui/button";

export function ReportJobButton({ jobId }: { jobId: string }) {
  const { user } = useAuth();
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="text-sm text-[var(--color-muted)]">Report submitted.</p>;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      onClick={async () => {
        await createReport({
          reporterId: user?.uid ?? "anonymous",
          reason: "other",
          targetType: "job",
          targetId: jobId,
          details: "Reported from job detail page",
        });
        setDone(true);
      }}
    >
      Report this opportunity
    </Button>
  );
}
